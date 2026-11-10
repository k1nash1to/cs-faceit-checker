/** Утилиты: TTL-кэш и ограниченная параллельность. */

export const TTL = {
  steamProfile: 60_000,
  steamGames: 10 * 60_000,
  faceitLink: 5 * 60_000,
  faceitLifetime: 10 * 60_000,
  faceitHistory: 2 * 60_000,
  faceitMatch: 24 * 60 * 60_000, // матч сыгран — данные меняться не будут
};

const store = new Map();

/**
 * Кэш в памяти процесса.
 *
 * FACEIT жёстко лимитирует запросы на ключ, а история матчей у одного и того же
 * игрока часто запрашивается подряд — кэш экономит и время, и лимит.
 */
export async function cached(key, ttlMs, loader) {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const value = await loader();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });

  if (store.size > 800) {
    const now = Date.now();
    for (const [entryKey, entry] of store) {
      if (entry.expiresAt <= now) store.delete(entryKey);
    }
    // Если всё ещё много — режем самые старые записи
    while (store.size > 600) {
      const oldest = store.keys().next().value;
      store.delete(oldest);
    }
  }

  return value;
}

/** Promise.all с лимитом одновременных задач. */
export async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const size = Math.max(1, Math.min(limit, items.length));

  await Promise.all(
    Array.from({ length: size }, async () => {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) return;
        try {
          results[index] = await worker(items[index], index);
        } catch {
          results[index] = null;
        }
      }
    }),
  );

  return results;
}
