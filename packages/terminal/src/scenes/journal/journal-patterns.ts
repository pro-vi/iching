// journal-patterns — quiet observation over the journal's entries.
//
// Pure derivation: which hexagrams keep arriving, how much has been cast,
// where the moving lines tend to sit. Counts and dates only — observation,
// never a score, never a streak.

import type { HistoryEntry } from "@iching/core";

export interface HexagramFrequency {
  kw: number;
  count: number;
  lastDate: string;
}

export interface JournalPatterns {
  /** Total readings loaded. */
  total: number;
  /** Readings whose date falls in today's month. */
  thisMonth: number;
  /** Most-seen primary hexagrams, count desc then KW asc. */
  topHexagrams: HexagramFrequency[];
  /** Most common changing-line position (1–6), or null when nothing moved. */
  movingLine: { position: number; count: number } | null;
}

/**
 * Derive the patterns summary from journal entries.
 * @param today local YYYY-MM-DD — its YYYY-MM prefix defines "this month".
 */
export function computeJournalPatterns(
  entries: HistoryEntry[],
  today: string,
  topN = 5,
): JournalPatterns {
  const month = today.slice(0, 7);
  const freq = new Map<number, { count: number; lastDate: string }>();
  const lineCounts = [0, 0, 0, 0, 0, 0];
  let thisMonth = 0;

  for (const entry of entries) {
    if (entry.date.startsWith(month)) thisMonth++;

    const f = freq.get(entry.cast.primary) ?? { count: 0, lastDate: "" };
    f.count++;
    if (entry.date > f.lastDate) f.lastDate = entry.date;
    freq.set(entry.cast.primary, f);

    for (const pos of entry.cast.changingPositions ?? []) {
      if (pos >= 1 && pos <= 6) lineCounts[pos - 1]++;
    }
  }

  const topHexagrams: HexagramFrequency[] = [...freq.entries()]
    .map(([kw, f]) => ({ kw, count: f.count, lastDate: f.lastDate }))
    .sort((a, b) => b.count - a.count || a.kw - b.kw)
    .slice(0, topN);

  let movingLine: JournalPatterns["movingLine"] = null;
  for (let i = 0; i < 6; i++) {
    if (lineCounts[i] > 0 && (movingLine === null || lineCounts[i] > movingLine.count)) {
      movingLine = { position: i + 1, count: lineCounts[i] };
    }
  }

  return { total: entries.length, thisMonth, topHexagrams, movingLine };
}
