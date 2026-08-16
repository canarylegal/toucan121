/** Short-lived in-process cache for external calendar busy fetches. */
type CacheEntry<T> = { expiresAt: number; value: T };

const store = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return null;
  }
  return hit.value as T;
}

export function setCache<T>(key: string, value: T, ttlMs: number) {
  store.set(key, { expiresAt: Date.now() + ttlMs, value });
}

export function invalidateCachePrefix(prefix: string) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
