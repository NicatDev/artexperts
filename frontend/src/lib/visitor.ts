const storageKey = "art-experts-visitor";
let memoryId: string | null = null;

export function rememberVisitorId(id: string) {
  if (!/^[0-9a-f]{32}$/i.test(id)) return;
  memoryId = id.toLowerCase();
  try { window.localStorage.setItem(storageKey, memoryId); } catch { /* Cookies and memory still work when storage is unavailable. */ }
}

export function getVisitorId(): string {
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved && /^[0-9a-f]{32}$/i.test(saved)) { memoryId = saved.toLowerCase(); return memoryId; }
  } catch { /* Use the in-memory id until the server returns its cookie id. */ }
  if (!memoryId) rememberVisitorId(Array.from(window.crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join(""));
  return memoryId!;
}
