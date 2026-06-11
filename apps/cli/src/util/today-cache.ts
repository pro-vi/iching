import type { DailyCacheRecord, DailyCacheStore } from "@iching/storage";

/**
 * Resolve the daily cache iff it belongs to (the current) today.
 *
 * Both the clock and the store are re-read at call time — never decide from
 * snapshots taken before a blocking scene run. The home scene can sit open
 * across midnight (or while a hook process writes a fresh cache); comparing
 * two pre-run snapshots replayed yesterday's reading as today's when [t]
 * was finally pressed. Stale or missing → null, and the home loop simply
 * re-renders with current data.
 */
export async function readTodayCache(
  cacheStore: DailyCacheStore,
  today: () => string,
): Promise<DailyCacheRecord | null> {
  const cache = await cacheStore.read();
  return cache && cache.date === today() ? cache : null;
}
