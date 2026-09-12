/** Tiny in-memory TTL cache for hot API reads (Neon RTT is multi-second). */

type Entry<T> = { at: number; value: T }

const store = new Map<string, Entry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined
  if (hit && Date.now() - hit.at < ttlMs) return hit.value

  const pending = inflight.get(key) as Promise<T> | undefined
  if (pending) return pending

  const run = (async () => {
    try {
      const value = await loader()
      store.set(key, { at: Date.now(), value })
      return value
    } finally {
      inflight.delete(key)
    }
  })()

  inflight.set(key, run)
  return run
}

export function invalidateCache(prefix = '') {
  for (const key of store.keys()) {
    if (!prefix || key.startsWith(prefix)) store.delete(key)
  }
}
