import { api, ApiError } from './api';
import { xhrJson, UploadError, type UploadProgress } from './content-upload';
const CHUNK = 8 * 1024 * 1024;
type Status = { id: string; uploaded: number; size: number; chunk_size: number; state: string };
const hex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join('');
export async function uploadLearning(file: File, role: string, scope: string, signal: AbortSignal, report: (p: UploadProgress) => void) {
  const emit = (stage: UploadProgress['stage'], loaded = 0) => report({ stage, loaded, total: file.size, percent: Math.floor(loaded * 100 / file.size) });
  const check = () => { if(signal.aborted) throw new UploadError('paused'); };
  emit('preparing'); const csrf = (await api.getCsrfToken()).csrfToken;
  const hashes: string[] = [];
  for(let offset = 0;offset < file.size;offset += CHUNK) { check(); hashes.push(hex(await crypto.subtle.digest('SHA-256', await file.slice(offset, offset + CHUNK).arrayBuffer()))); emit('preparing', Math.min(file.size, offset + CHUNK)); }
  const key = `learning:${scope}:${role}:${file.size}:${hashes.join('')}`;
  let session: Status | undefined;
  try { const id = localStorage.getItem(key); if(id) session = await xhrJson<Status>(`/learning/uploads/${id}/`, 'GET', null, '', { signal }); } catch(e) { if(!(e instanceof ApiError && e.status === 404)) throw e; }
  if(!session) { session = await xhrJson<Status>('/learning/uploads/', 'POST', JSON.stringify({ filename: file.name, size: file.size, role, hashes }), csrf, { signal }); try { localStorage.setItem(key, session.id); } catch { } }
  while(session.uploaded < file.size) {    
check(); let success = false;
    for(let attempt = 0;attempt < 4;attempt++) {
      const offset = session.uploaded, chunk = file.slice(offset, offset + CHUNK), form = new FormData(); form.append('offset', String(offset)); form.append('chunk', chunk, 'chunk.bin');
      try { session = await xhrJson<Status>(`/learning/uploads/${session.id}/chunks/`, 'POST', form, csrf, { signal, progress: f => emit('uploading', offset + Math.floor(chunk.size * f)), sent: () => { if(offset + chunk.size === file.size) emit('verifying', file.size); } }); success = true; break; }
      catch(e) { check(); if(e instanceof ApiError && ![408, 409, 429, 500, 502, 503, 504, 520, 522, 524].includes(e.status)) throw e; if(attempt === 3) throw e; emit('retrying', offset); await new Promise(r => setTimeout(r, 1000 * 2 ** attempt)); check(); session = await xhrJson<Status>(`/learning/uploads/${session.id}/`, 'GET', null, '', { signal }); }
    } if(!success) throw new UploadError('network');
  } return session.id;
}
