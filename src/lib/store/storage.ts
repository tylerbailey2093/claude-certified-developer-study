// Namespaced localStorage with change notification. Every write dispatches a
// `ccdvf:store` event so React islands on the same page re-render; the native
// `storage` event covers other tabs. Storage can throw (private mode, quota),
// so every access is guarded and a failed write raises a visible event
// instead of silently losing progress.
export const NS = 'ccdvf:v2:';
export const V1_NS = 'ccdvf:v1:';
export const STORE_EVENT = 'ccdvf:store';
export const STORE_ERROR_EVENT = 'ccdvf:store-error';

const memory = new Map<string, string>(); // fallback when localStorage is unavailable

function ls(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readRaw(fullKey: string): string | null {
  const s = ls();
  try {
    return s ? s.getItem(fullKey) : memory.get(fullKey) ?? null;
  } catch {
    return memory.get(fullKey) ?? null;
  }
}

export function read<T>(key: string, fallback: T): T {
  const raw = readRaw(NS + key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// Cache parsed values by raw string so useSyncExternalStore gets stable
// references between renders (it requires getSnapshot to be referentially stable).
const snapCache = new Map<string, { raw: string | null; value: unknown }>();

export function snapshot<T>(key: string, fallback: T): T {
  const raw = readRaw(NS + key);
  const hit = snapCache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value: unknown = fallback;
  if (raw != null) {
    try {
      value = JSON.parse(raw);
    } catch {
      value = fallback;
    }
  }
  snapCache.set(key, { raw, value });
  return value as T;
}

export function write<T>(key: string, value: T): boolean {
  const raw = JSON.stringify(value);
  const s = ls();
  try {
    if (s) s.setItem(NS + key, raw);
    else memory.set(NS + key, raw);
  } catch (e) {
    memory.set(NS + key, raw);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(STORE_ERROR_EVENT, { detail: { key, error: String(e) } }));
    }
    notify(key);
    return false;
  }
  notify(key);
  return true;
}

export function remove(key: string): void {
  const s = ls();
  try {
    s?.removeItem(NS + key);
  } catch {
    /* ignore */
  }
  memory.delete(NS + key);
  notify(key);
}

export function notify(key: string): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(STORE_EVENT, { detail: { key } }));
}

export function subscribe(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key.startsWith(NS)) cb();
  };
  window.addEventListener(STORE_EVENT, cb);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(STORE_EVENT, cb);
    window.removeEventListener('storage', onStorage);
  };
}

export function allKeys(prefix = NS): string[] {
  const s = ls();
  if (!s) return [...memory.keys()].filter((k) => k.startsWith(prefix));
  const out: string[] = [];
  try {
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && k.startsWith(prefix)) out.push(k);
    }
  } catch {
    /* ignore */
  }
  return out;
}
