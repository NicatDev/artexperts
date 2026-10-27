import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Exercise the actual browser upload service with deterministic transport faults.
// No network calls, production accounts or production files are used.
const bundle = await build({
  absWorkingDir: fileURLToPath(new URL('../', import.meta.url)),
  entryPoints: [fileURLToPath(new URL('../src/lib/content-upload.ts', import.meta.url))], bundle: true, write: false,
  platform: 'node', format: 'cjs', tsconfigRaw: {}, alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) },
});
const loaded = { exports: {} };
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
const { saveContentUpload, UploadError } = loaded.exports;
const CHUNK = 8 * 1024 * 1024;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pdf = new File(['%PDF-1.7\n', new Uint8Array(CHUNK + 57), '\n%%EOF'], 'upload.pdf', { type: 'application/pdf' });
const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: key => storage.delete(key),
};

function transport(fault = {}) {
  const sessions = new Map();
  const requests = [];
  let publishes = 0;
  let chunkCalls = 0;
  let starts = 0;
  let statusCalls = 0;
  let once = false;
  const status = ({ id, uploaded, size, chunk_size, state, book_id }) => ({ id, uploaded, size, chunk_size, state, book_id });
  class Xhr {
    upload = {};
    headers = {};
    status = 0;
    responseText = '';
    stopped = false;
    open(method, url) { this.method = method; this.path = new URL(url).pathname.replace('/api/v1', ''); }
    setRequestHeader(key, value) { this.headers[key] = value; }
    abort() { this.stopped = true; this.onabort?.(); }
    send(body) {
      requests.push({ method: this.method, path: this.path });
      setImmediate(async () => {
        if (this.stopped) return;
        try {
          assert.equal(this.withCredentials, true);
          const respond = (data, status = 200) => {
            if (this.stopped) return;
            this.status = status; this.responseText = typeof data === 'string' ? data : JSON.stringify(data); this.onload();
          };
          if (this.path === '/auth/csrf/') return respond({ csrfToken: 'test-csrf' });
          if (this.method !== 'GET') assert.equal(this.headers['X-CSRFToken'], 'test-csrf');
          if (this.path === '/books/uploads/') {
            starts++;
            if (fault.startStatus) return respond({ error: { details: {} } }, fault.startStatus);
            const manifest = JSON.parse(body);
            const session = { id: randomUUID(), uploaded: 0, size: manifest.size, chunk_size: CHUNK, state: 'UPLOADING', book_id: null, hashes: manifest.hashes, chunks: [] };
            sessions.set(session.id, session);
            return respond(status(session), 201);
          }
          const match = this.path.match(/^\/books\/uploads\/([^/]+)\/(chunks\/)?$/);
          if (match) {
            const session = sessions.get(match[1]);
            if (!session) return respond({}, 404);
            if (!match[2]) {
              statusCalls++;
              if (fault.statusOffline && statusCalls === 1) return this.onerror();
              return respond(status(session));
            }
            chunkCalls++;
            if (fault.alwaysOffline) return this.onerror();
            const offset = Number(body.get('offset'));
            const bytes = new Uint8Array(await body.get('chunk').arrayBuffer());
            if (this.stopped) return;
            assert.equal(sha(bytes), session.hashes[offset / CHUNK]);
            if (fault.pause && !once) {
              once = true;
              fault.pause.abort();
              return;
            }
            this.upload.onprogress?.({ loaded: bytes.length / 2, total: bytes.length, lengthComputable: true });
            this.upload.onprogress?.({ loaded: bytes.length, total: bytes.length, lengthComputable: true });
            this.upload.onload?.();
            if (offset === session.uploaded) {
              session.chunks.push(bytes);
              session.uploaded += bytes.length;
            }
            if (session.uploaded === session.size) session.state = 'READY';
            if (fault.loseAck && !once) { once = true; return this.onerror(); }
            return respond(status(session));
          }
          if (this.path === '/books/publish/') {
            assert.equal(body.has('digital_file'), false, 'PDF must not be resent in the final request');
            const session = sessions.get(body.get('pdf_upload_id'));
            assert.equal(session.state, 'READY');
            assert.equal(sha(Buffer.concat(session.chunks)), sha(new Uint8Array(await pdf.arrayBuffer())));
            if (fault.validation && !once) { once = true; return respond({ error: { details: { title_az: ['Required.'] } } }, 400); }
            this.upload.onload?.();
            session.state = 'CONSUMED'; session.book_id = 'saved-book'; publishes++;
            if (fault.loseFinal) return this.onerror();
            return respond({ id: 'saved-book' }, 201);
          }
          if (this.path === '/books/saved-book/manage/') return respond({ id: 'saved-book' });
          if (this.path === '/articles/publish/') {
            this.upload.onprogress?.({ loaded: 1, total: 1, lengthComputable: true });
            this.upload.onload?.();
            return respond({ id: 'article' }, 201);
          }
          throw new Error(`Unexpected route ${this.path}`);
        } catch (error) {
          this.testError = error;
          this.status = 599; this.responseText = JSON.stringify({ error: { message: error.message } }); this.onload();
        }
      });
    }
  }
  globalThis.XMLHttpRequest = Xhr;
  return { sessions, requests, get starts() { return starts; }, get chunks() { return chunkCalls; }, get publishes() { return publishes; } };
}

function submission() {
  const form = new FormData();
  form.set('digital_file', pdf); form.set('submission_id', randomUUID()); form.set('title_az', 'Test');
  return form;
}
function options(extra = {}) { return { scope: randomUUID(), onProgress() {}, ...extra }; }

test('PDF travels in bounded chunks with stages and confirmed byte counts', async () => {
  const server = transport(); const progress = [];
  assert.deepEqual(await saveContentUpload('books', submission(), undefined, options({ onProgress: p => progress.push(p) })), { id: 'saved-book' });
  assert.equal(server.starts, 1); assert.equal(server.chunks, 2); assert.equal(server.publishes, 1);
  for (const stage of ['preparing', 'uploading', 'verifying', 'saving', 'complete']) assert.ok(progress.some(p => p.stage === stage), stage);
  assert.equal(progress.at(-1).loaded, pdf.size); assert.equal(progress.at(-1).percent, 100);
  assert.ok(progress.every(p => p.percent === null || p.percent >= 0 && p.percent <= 100));
});

test('pause and retry retain the session and do not start another upload', async () => {
  const controller = new AbortController(); const server = transport({ pause: controller }); const scope = randomUUID();
  await assert.rejects(saveContentUpload('books', submission(), undefined, options({ scope, signal: controller.signal })), error => error instanceof UploadError && error.code === 'paused');
  await saveContentUpload('books', submission(), undefined, options({ scope }));
  assert.equal(server.starts, 1); assert.equal(server.publishes, 1);
});

test('lost acknowledgement and failed status lookup recover without duplicate bytes', async () => {
  const server = transport({ loseAck: true, statusOffline: true }); const progress = [];
  await saveContentUpload('books', submission(), undefined, options({ onProgress: p => progress.push(p) }));
  assert.equal(server.publishes, 1); assert.ok(progress.some(p => p.stage === 'retrying'));
  assert.equal(server.chunks, 3, 'one safe retry, then the second chunk');
});

test('lost publish response resolves the consumed session without a second publication', async () => {
  const server = transport({ loseFinal: true });
  assert.deepEqual(await saveContentUpload('books', submission(), undefined, options()), { id: 'saved-book' });
  assert.equal(server.publishes, 1);
});

test('field validation preserves the ready PDF for corrected metadata', async () => {
  const server = transport({ validation: true }); const scope = randomUUID();
  await assert.rejects(saveContentUpload('books', submission(), undefined, options({ scope })), error => error.status === 400 && !!error.details.title_az);
  await saveContentUpload('books', submission(), undefined, options({ scope }));
  assert.equal(server.starts, 1); assert.equal(server.chunks, 2); assert.equal(server.publishes, 1);
});

test('authentication, body limit and disk errors are actionable and not retried', async () => {
  for (const [status, code] of [[403, 'auth'], [413, 'limit'], [507, 'storage']]) {
    const server = transport({ startStatus: status });
    await assert.rejects(saveContentUpload('books', submission(), undefined, options()), error => error.code === code);
    assert.equal(server.starts, 1); assert.equal(server.chunks, 0);
  }
});

test('persistent outage has a bounded retry budget and keeps its resume token', async () => {
  const server = transport({ alwaysOffline: true }); const scope = randomUUID();
  await assert.rejects(saveContentUpload('books', submission(), undefined, options({ scope })), error => error.code === 'network');
  assert.equal(server.chunks, 4); assert.equal(server.starts, 1);
  assert.ok([...storage.keys()].some(key => key.includes(scope)));
});

test('article metadata and cover upload also report bytes and completion', async () => {
  transport(); const progress = []; const form = new FormData(); form.set('content_az', '<p>Text</p>');
  assert.deepEqual(await saveContentUpload('articles', form, undefined, options({ onProgress: p => progress.push(p) })), { id: 'article' });
  assert.equal(progress.at(-1).total, new TextEncoder().encode('<p>Text</p>').length);
  assert.equal(progress.at(-1).percent, 100);
});
