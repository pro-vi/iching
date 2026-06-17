// patterns/time.ts — temporal keys, day-phase, and the canonical reading order.
//
// Everything the derivation needs to order readings in time and bin them by
// when they happened. Pure and timezone-free at the seams the tests touch (the
// caller supplies the local hour to phaseOfHour); the day arithmetic projects
// to UTC midnight so a date string maps to a stable ordinal.

import type { HistoryEntry } from "../../types.js";

/** Below this many timestamped readings, a phase shape is noise — withhold it. */
export const PHASE_MIN_TIMESTAMPED = 5;

/**
 * Map a local hour (0–23) to a day phase: 0 晨 dawn / 1 晝 day / 2 暮 dusk /
 * 3 夜 night — four even six-hour quarters (5–10 / 11–16 / 17–22 / 23–4), each
 * spanning three classical 時辰. Pure and timezone-free: the caller supplies
 * the local hour, so this is testable without pinning a runtime zone.
 */
export function phaseOfHour(hour: number): 0 | 1 | 2 | 3 {
  if (hour >= 5 && hour < 11) return 0; // 晨 dawn (卯辰巳)
  if (hour >= 11 && hour < 17) return 1; // 晝 day (午未申)
  if (hour >= 17 && hour < 23) return 2; // 暮 dusk (酉戌亥)
  return 3; // 夜 night (子丑寅, wraps 23–4)
}

/**
 * Canonical chronological order for readings: by time-key, then deterministically
 * by cast content so same-instant ties (legacy same-day readings) resolve the
 * same regardless of input order. Exported so callers/tests can reproduce the
 * exact order the derivation (transitions, drift, field.recent) reads.
 */
export function compareEntryTime(a: HistoryEntry, b: HistoryEntry): number {
  const byTime = entryTimeKey(a).localeCompare(entryTimeKey(b));
  if (byTime !== 0) return byTime;
  // Same instant — legacy same-day readings without timestamps, or identical
  // stamps. Break the tie deterministically by cast content so the derived
  // order (and the transitions / drift / recency that read it) never depends on
  // whether the caller passed newest-first (TUI) or append (CLI) order: those
  // two surfaces must agree on the same journal. Identical readings compare
  // equal, but their order can't change any output.
  return (
    a.cast.primary - b.cast.primary ||
    (a.cast.becoming ?? 0) - (b.cast.becoming ?? 0) ||
    a.cast.changingPositions.join(",").localeCompare(b.cast.changingPositions.join(","))
  );
}

/**
 * The sortable instant of a reading — its timestamp, or its local date at
 * midnight when no timestamp was recorded. This is the SAME key the patterns
 * pane uses to pick the most-recent reading (the ◉ recency accent), so any
 * surface that wants "newest" must order by this to agree with the pane.
 */
export function entryTimeKey(entry: HistoryEntry): string {
  // A timestamp can only act as the sort key if it is a non-empty, parseable
  // instant. An empty or malformed string (a hand-edit or a bad import — the
  // store already normalizes non-STRING stamps to absent, but "" and garbage
  // survive) is NOT caught by `??`, so it would sort as the epoch "oldest",
  // displacing the entry's own date. Fall back to date-at-midnight — the same
  // key a timestamp-less entry uses — whenever the stamp can't be trusted.
  const ts = entry.timestamp;
  if (ts && !Number.isNaN(Date.parse(ts))) return ts;
  return `${entry.date}T00:00:00.000Z`;
}

/**
 * The integer day-ordinal of a YYYY-MM-DD date (days since the UTC epoch), or
 * null when the string is not a real calendar date. Round-trips through UTC so
 * gap/span/idle arithmetic is timezone-free and rejects e.g. 2026-02-30.
 */
export function dayOrdinal(date: string): number | null {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const ms = Date.UTC(year, month - 1, day);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms);
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return Math.floor(ms / 86_400_000);
}
