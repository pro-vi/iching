import type { DailyCacheRecord, DailyCacheStore, JournalStore } from "@iching/storage";
import { buildStructure } from "@iching/core";

/**
 * Resolve "today's reading", honoring the durable-recovery invariant: the daily
 * cache is a fast MIRROR of the journal, never the source of truth. Read the
 * cache first; when it is absent, stale (yesterday's after a midnight rollover),
 * or was quarantined as corrupt, fall back to the journal — the durable,
 * append-only record — exactly as the hook and `iching today` do, rebuilding the
 * display structure from the recovered cast. The single resolver every "today"
 * reader shares, so the three surfaces (TUI [t], `iching today`, the hook) can't
 * drift on what "today's reading" is. See docs/process/durable-recovery.md.
 *
 * Both the clock and the stores are re-read at call time — never decided from
 * snapshots taken before a blocking scene run. The home scene can sit open
 * across midnight (or while a hook process writes a fresh cache); comparing
 * two pre-run snapshots replayed yesterday's reading as today's when [t] was
 * finally pressed. Stale / missing / unrecoverable → null, and the caller shows
 * its calm "no reading yet" state.
 */
export async function resolveTodayReading(
  cacheStore: DailyCacheStore,
  journal: JournalStore,
  today: () => string,
): Promise<DailyCacheRecord | null> {
  const t = today();
  const cache = await cacheStore.read();
  if (cache && cache.date === t) return cache;

  // Cache absent / stale / quarantined — recover from the journal. Best-effort
  // like the hook: a blocked or unreadable data dir resolves to null (→ the
  // caller's calm invitation), never a crash.
  const recovered = await journal.latest().catch(() => null);
  if (recovered && recovered.date === t) {
    // The journal entry carries no structure/shown; derive structure from the
    // cast (as the hook does) and mark it shown — it was cast today.
    return {
      date: recovered.date,
      cast: recovered.cast,
      shown: true,
      structure: buildStructure(recovered.cast),
      intention: recovered.intention,
      method: recovered.method,
      rng: recovered.rng,
    };
  }
  return null;
}
