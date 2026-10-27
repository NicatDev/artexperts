import { ApiError } from "./api";
import { siteConfig } from "@/config/site";

export type UploadStage = "preparing" | "uploading" | "retrying" | "verifying" | "saving" | "complete";
export type UploadProgress = { stage: UploadStage; loaded: number; total: number; percent: number | null; speed?: number; eta?: number; attempt?: number; sessionId?: string };
export type UploadOptions = { signal?: AbortSignal; scope: string; onProgress: (progress: UploadProgress) => void };
export class UploadError extends Error {
  constructor(public code: string) { super(code); this.name = "UploadError"; }
}
type Session = { id: string; uploaded: number; size: number; chunk_size: number; state: string; book_id: string | null };
const CHUNK = 8 * 1024 * 1024;
const memorySessions = new Map<string, string>();

function aborted(signal?: AbortSignal) { if (signal?.aborted) throw new UploadError("paused"); }
function hex(buffer: ArrayBuffer) { return Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, "0")).join(""); }
function stored(key: string) { try { return localStorage.getItem(key) || memorySessions.get(key); } catch { return memorySessions.get(key); } }
function remember(key: string, id?: string) {
  if (id) memorySessions.set(key, id); else memorySessions.delete(key);
  try { if (id) localStorage.setItem(key, id); else localStorage.removeItem(key); } catch { /* Storage can be disabled. */ }
}

function xhrJson<T>(path: string, method: string, body: FormData | string | null, csrf: string, options: {
  signal?: AbortSignal; progress?: (fraction: number) => void; sent?: () => void;
} = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) { reject(new UploadError("paused")); return; }
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${siteConfig.apiUrl}${path}`);
    xhr.withCredentials = true;
    xhr.timeout = 120000;
    xhr.setRequestHeader("Accept", "application/json");
    if (csrf) xhr.setRequestHeader("X-CSRFToken", csrf);
    if (typeof body === "string") xhr.setRequestHeader("Content-Type", "application/json");
    let lastActivity = Date.now();
    let sent = false;
    let stalled = false;
    const abort = () => xhr.abort();
    const timer = setInterval(() => {
      if (!sent && Date.now() - lastActivity > 45000) { stalled = true; xhr.abort(); }
    }, 5000);
    const cleanup = () => { clearInterval(timer); options.signal?.removeEventListener("abort", abort); };
    options.signal?.addEventListener("abort", abort, { once: true });
    xhr.upload.onprogress = event => { lastActivity = Date.now(); if (event.lengthComputable && event.total) options.progress?.(event.loaded / event.total); };
    xhr.upload.onload = () => { sent = true; options.sent?.(); };
    xhr.onload = () => {
      cleanup();
      let data: unknown = {};
      let parsed = false;
      try { data = xhr.responseText ? JSON.parse(xhr.responseText) : {}; parsed = !!xhr.responseText; } catch { /* Proxy errors may contain HTML. */ }
      if (xhr.status >= 200 && xhr.status < 300) {
        if (!parsed && xhr.status !== 204) reject(new UploadError("server"));
        else resolve(data as T);
      }
      else {
        const envelope = data as { error?: { message?: string; details?: unknown } } | null;
        reject(new ApiError(envelope?.error?.message || `HTTP ${xhr.status}`, envelope?.error?.details || data, xhr.status));
      }
    };
    xhr.onerror = () => { cleanup(); reject(new UploadError("network")); };
    xhr.ontimeout = () => { cleanup(); reject(new UploadError("timeout")); };
    xhr.onabort = () => { cleanup(); reject(new UploadError(stalled ? "stalled" : "paused")); };
    try { xhr.send(body); } catch { cleanup(); reject(new UploadError("network")); }
  });
}

function uploadError(error: unknown): UploadError {
  if (error instanceof UploadError) return error;
  if (error instanceof ApiError) {
    if (error.status === 400 && error.details && typeof error.details === "object" && "upload" in error.details) return new UploadError("quota");
    return new UploadError(error.status === 413 ? "limit" : error.status === 507 ? "storage" : [401, 403].includes(error.status) ? "auth" : error.status === 429 ? "rate" : error.status === 400 ? "invalid" : "server");
  }
  return new UploadError("network");
}
function retryable(error: unknown) {
  return error instanceof UploadError ? ["network", "stalled", "timeout"].includes(error.code)
    : error instanceof ApiError && [408, 409, 429, 500, 502, 503, 504, 520, 522, 524].includes(error.status);
}
async function delay(milliseconds: number, signal?: AbortSignal) {
  aborted(signal);
  await new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new UploadError("paused")); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, milliseconds);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export async function saveContentUpload(kind: "books" | "artworks" | "articles", form: FormData, id: string | undefined, options: UploadOptions) {
  const { signal, onProgress } = options;
  const pdf = form.get("digital_file");
  const file = pdf instanceof File && pdf.size ? pdf : null;
  let session: Session | null = null;
  let key = "";
  let lastProgress = 0;
  const emit = (stage: UploadStage, loaded = 0, total = file?.size || 0, extra: Partial<UploadProgress> = {}) => {
    const now = performance.now();
    if (stage === "uploading" && now - lastProgress < 150 && loaded < total) return;
    lastProgress = now;
    onProgress({ stage, loaded, total, percent: total ? Math.min(100, Math.floor(loaded * 100 / total)) : null, sessionId: session?.id, ...extra });
  };
  emit("preparing");
  let csrf: string;
  try {
    const data = await xhrJson<{ csrfToken: string }>("/auth/csrf/", "GET", null, "", { signal });
    csrf = data.csrfToken;
  } catch (error) { throw uploadError(error); }
  if (file && kind === "books") {
    try {
      if (file.size > 300 * 1024 * 1024) throw new UploadError("limit");
      if (!globalThis.crypto?.subtle) throw new UploadError("browser");
      if (new TextDecoder().decode(await file.slice(0, 5).arrayBuffer()) !== "%PDF-") throw new UploadError("invalid");
      const hashes: string[] = [];
      for (let offset = 0; offset < file.size; offset += CHUNK) {
        aborted(signal);
        const bytes = await file.slice(offset, offset + CHUNK).arrayBuffer();
        hashes.push(hex(await crypto.subtle.digest("SHA-256", bytes)));
        emit("preparing", Math.min(file.size, offset + CHUNK));
      }
      const fingerprint = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${file.size}:${hashes.join(":")}`)));
      key = `art-experts:pdf-upload:${options.scope}:${fingerprint}`;
      const existing = stored(key);
      if (existing) {
        try { session = await xhrJson<Session>(`/books/uploads/${existing}/`, "GET", null, "", { signal }); }
        catch (error) { if (!(error instanceof ApiError) || ![404, 410].includes(error.status)) throw error; remember(key); }
      }
      if (!session) {
        const filename = file.name.length > 250 ? file.name.slice(0, 246) + ".pdf" : file.name;
        session = await xhrJson<Session>("/books/uploads/", "POST", JSON.stringify({ filename, size: file.size, hashes, book_id: id || null }), csrf, { signal });
        remember(key, session.id);
      }
      if (!session) throw new UploadError("server");
      let current: Session = session;
      const started = performance.now();
      const base = current.uploaded;
      const progress = (loaded: number, stage: UploadStage = "uploading", attempt?: number) => {
        const seconds = (performance.now() - started) / 1000;
        const speed = seconds > 1 ? Math.max(0, loaded - base) / seconds : 0;
        emit(stage, loaded, file.size, { speed, eta: speed > 0 ? Math.ceil((file.size - loaded) / speed) : undefined, attempt });
      };
      progress(current.uploaded);
      while (current.uploaded < file.size) {
        const offset = current.uploaded;
        const chunk = file.slice(offset, offset + current.chunk_size);
        let acknowledged = false;
        for (let attempt = 0; attempt < 4; attempt++) {
          aborted(signal);
          try {
            const part = new FormData();
            part.append("offset", String(offset));
            part.append("chunk", chunk, "chunk.bin");
            const next: Session = await xhrJson<Session>(`/books/uploads/${current.id}/chunks/`, "POST", part, csrf, {
              signal, progress: fraction => progress(offset + Math.floor(chunk.size * fraction)),
              sent: () => { if (offset + chunk.size === file.size) emit("verifying", file.size); },
            });
            if (next.uploaded <= offset) throw new UploadError("server");
            current = next;
            session = current;
            acknowledged = true;
            break;
          } catch (error) {
            if (!retryable(error) || attempt === 3) throw error;
            progress(offset, "retrying", attempt + 1);
            await delay(error instanceof ApiError && error.status === 429 ? 15000 : 1000 * 2 ** attempt, signal);
            try {
              current = await xhrJson<Session>(`/books/uploads/${current.id}/`, "GET", null, "", { signal });
              session = current;
              // A lost acknowledgement may advance the offset; a recovered
              // server file may rewind it. Rebuild the chunk for either case.
              if (current.uploaded !== offset) { acknowledged = true; break; }
            } catch (statusError) {
              if (!retryable(statusError)) throw statusError;
              // A brief outage can affect the status request too. The next
              // chunk request is safe to repeat and remains within this budget.
            }
          }
        }
        if (!acknowledged) throw new UploadError("network");
      }
      form.delete("digital_file");
      form.append("pdf_upload_id", current.id);
    } catch (error) { throw uploadError(error); }
  }
  aborted(signal);
  const bodyTotal = Array.from(form.values()).reduce((total, value) => total + (typeof value === "string" ? new TextEncoder().encode(value).byteLength : value.size), 0);
  emit("saving", file?.size || 0, file?.size || 0, { percent: null });
  try {
    const result = await xhrJson<unknown>(id ? `/${kind}/${id}/manage/` : `/${kind}/publish/`, id ? "PATCH" : "POST", form, csrf, {
      signal, progress: fraction => { if (!file) emit("uploading", Math.floor(fraction * bodyTotal), bodyTotal); },
      sent: () => emit("saving", file?.size || 0, file?.size || 0, { percent: null }),
    });
    if (key) remember(key);
    emit("complete", file?.size || bodyTotal, file?.size || bodyTotal);
    return result;
  } catch (error) {
    if (session && (error instanceof UploadError || error instanceof ApiError && error.status >= 500)) {
      try {
        const status = await xhrJson<Session>(`/books/uploads/${session.id}/`, "GET", null, "", { signal });
        if (status.state === "CONSUMED" && status.book_id) {
          const result = await xhrJson<unknown>(`/books/${status.book_id}/manage/`, "GET", null, "", { signal });
          remember(key); emit("complete", file!.size, file!.size); return result;
        }
      } catch { /* Retain the resume token if the final result cannot be confirmed. */ }
    }
    if (error instanceof ApiError && error.status === 400) throw error;
    throw uploadError(error);
  }
}
