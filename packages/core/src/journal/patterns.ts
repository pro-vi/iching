// journal patterns — quiet observation over the journal's entries.
//
// Pure derivation: distribution, cadence, lift, structure, and transitions.
// It stays descriptive: counts and rates over what arrived, never prediction.
// Lives in core (pure domain logic) so both the TUI pane and the CLI can read it.
//
// This module is the orchestrator: it drives the single pass over entries and
// assembles the result. The per-concern math is decomposed into sibling files —
// patterns/chance.ts (the observed-vs-expected model), patterns/time.ts
// (ordering & day-phase), patterns/summaries.ts (accumulate-then-emit per
// summary) — and the data contract in patterns/types.ts.

import { GUA } from "../data/gua.js";
import { trigramIndex } from "../identify/structure.js";
import { hourInZone } from "../zone.js";
import type { HistoryEntry } from "../types.js";

// The data contract lives in ./patterns/types.ts; re-export it so @iching/core's
// public surface is unchanged, and import the names this module derives.
export type {
  MethodFamily,
  MethodFamilyCounts,
  ExpectedComparison,
  DirectionComparison,
  BaselineSummary,
  HexagramFrequency,
  MovingLineFrequency,
  MovingLineCountBin,
  TrigramFrequency,
  PairFrequency,
  CadenceSummary,
  PhaseDistribution,
  DiversitySummary,
  StructuralEchoKind,
  StructuralEcho,
  HammingDistanceBin,
  HammingDriftSummary,
  FieldSummary,
  LineBalanceSummary,
  JournalPatterns,
} from "./patterns/types.js";
import type {
  MethodFamilyCounts,
  HexagramFrequency,
  MovingLineFrequency,
  MovingLineCountBin,
  TrigramFrequency,
  StructuralEcho,
  FieldSummary,
  JournalPatterns,
} from "./patterns/types.js";

import {
  methodFamily,
  comparison,
  LINE_PROBABILITIES,
  MOVING_COUNT_PROBABILITIES,
} from "./patterns/chance.js";
import {
  compareEntryTime,
  entryTimeKey,
  phaseOfHour,
  PHASE_MIN_TIMESTAMPED,
} from "./patterns/time.js";
import {
  addTrigram,
  addPair,
  addStructuralEcho,
  kingWenPair,
  hammingDistance,
  pairList,
  structuralEchoList,
  computeDiversity,
  computeCadence,
  hammingDrift,
} from "./patterns/summaries.js";

// Re-export the public temporal surface unchanged — index.ts and the test suite
// import these names from patterns.js.
export { compareEntryTime, entryTimeKey, phaseOfHour, PHASE_MIN_TIMESTAMPED };

/**
 * Derive the patterns summary from journal entries.
 * @param today local YYYY-MM-DD — its YYYY-MM prefix defines "this month".
 * @param timeZone IANA zone (or "system"/undefined for machine-local) — the 時
 *   phase-of-day binning projects each timestamp into this zone, so it agrees with
 *   the daily anchor instead of the report-runner's machine clock.
 */
export function computeJournalPatterns(
  entries: HistoryEntry[],
  today: string,
  topN = 5,
  timeZone?: string,
): JournalPatterns {
  const month = today.slice(0, 7);
  const freq = new Map<number, { count: number; lastDate: string }>();
  const knownFreq = new Map<number, { count: number; lastDate: string }>();
  const lineCounts = [0, 0, 0, 0, 0, 0];
  const knownLineCounts = [0, 0, 0, 0, 0, 0];
  const movingCountBins = [0, 0, 0, 0, 0, 0, 0];
  const knownMovingCountBins = [0, 0, 0, 0, 0, 0, 0];
  const trigramFreq = new Map<number, { count: number; upperCount: number; lowerCount: number }>();
  // Method-marked appearances per trigram — the basis the chance comparison
  // rests on, parallel to knownFreq for hexagrams.
  const knownTrigramCounts = new Map<number, number>();
  const transformations = new Map<string, { from: number; to: number; count: number; lastDate: string }>();
  const structural = new Map<string, StructuralEcho>();
  const methodCounts: MethodFamilyCounts = { coin: 0, yarrow: 0, unknown: 0, known: 0, total: 0 };
  let thisMonth = 0;
  let totalMovingLines = 0;
  let expectedOldYin = 0;
  let expectedOldYang = 0;
  let observedOldYin = 0;
  let observedOldYang = 0;
  let yangLines = 0;
  let yinLines = 0;
  let recentEntry: HistoryEntry | null = null;
  const phaseCounts: [number, number, number, number] = [0, 0, 0, 0];
  let timestampedCount = 0;

  for (const entry of entries) {
    const family = methodFamily(entry.method);
    methodCounts[family]++;
    methodCounts.total++;
    if (family !== "unknown") methodCounts.known++;

    if (entry.date.startsWith(month)) thisMonth++;

    // 時 — bin by the LOCAL phase of day, but only for readings that carry a
    // real timestamp. A legacy entry has none (the store leaves it ""); count
    // it here and it would pile at a false midnight phase. An unparseable
    // timestamp is likewise skipped, never bucketed into 夜 by a NaN hour.
    if (entry.timestamp) {
      const instant = new Date(entry.timestamp);
      if (!Number.isNaN(instant.getTime())) {
        phaseCounts[phaseOfHour(hourInZone(instant, timeZone))]++;
        timestampedCount++;
      }
    }

    // The most recent reading — the compareEntryTime-maximum, so a same-instant
    // tie (legacy same-day readings sharing a date key) resolves by content, not
    // input order. field.recent then agrees across the TUI (newest-first) and
    // the CLI (append-order), like the chronological sort the transitions use.
    if (recentEntry === null || compareEntryTime(entry, recentEntry) >= 0) {
      recentEntry = entry;
    }

    const f = freq.get(entry.cast.primary) ?? { count: 0, lastDate: "" };
    f.count++;
    if (entry.date > f.lastDate) f.lastDate = entry.date;
    freq.set(entry.cast.primary, f);

    // Normalize the moving positions once so every distribution describes the
    // SAME population. The app's writer only ever emits unique values in 1–6,
    // but the store admits any integer array (a hand-edited or corrupt record),
    // and feeding raw length to the per-cast bin while range-filtering the
    // per-position tally would desync the two — and inflate the rare-bin chance
    // figure. Dedup + keep 1–6: for well-formed casts this is a no-op.
    const changing = [
      ...new Set(
        (entry.cast.changingPositions ?? []).filter((p) => Number.isInteger(p) && p >= 1 && p <= 6),
      ),
    ];
    movingCountBins[changing.length]++; // length is now always 0–6
    totalMovingLines += changing.length;
    for (const pos of changing) lineCounts[pos - 1]++;
    // The 兩儀 balance is descriptive — every line's polarity across all
    // readings (a malformed entry missing its lines contributes nothing rather
    // than crashing the pane). The old-yang/yin tally, by contrast, is the
    // observed side of a chance *comparison*, so it counts only the
    // method-marked subset its expectation rests on — same basis on both sides.
    // (Pairing an all-readings count with a method-only expectation would
    // inflate the comparison in journals holding many legacy entries.)
    const lines = Array.isArray(entry.cast.lines) ? entry.cast.lines : [];
    for (const line of lines) {
      if (line.isYang) yangLines++;
      else yinLines++;
    }

    if (family !== "unknown") {
      const known = knownFreq.get(entry.cast.primary) ?? { count: 0, lastDate: "" };
      known.count++;
      if (entry.date > known.lastDate) known.lastDate = entry.date;
      knownFreq.set(entry.cast.primary, known);

      knownMovingCountBins[changing.length]++; // changing is normalized to 0–6 unique
      for (const pos of changing) knownLineCounts[pos - 1]++;
      for (const line of lines) {
        if (line.value === 6) observedOldYin++;
        if (line.value === 9) observedOldYang++;
        expectedOldYin += LINE_PROBABILITIES[family][6];
        expectedOldYang += LINE_PROBABILITIES[family][9];
      }
    }

    const gua = GUA[entry.cast.primary - 1];
    if (gua) {
      const lower = trigramIndex(gua.l.slice(0, 3));
      const upper = trigramIndex(gua.l.slice(3, 6));
      addTrigram(trigramFreq, lower, "lower");
      addTrigram(trigramFreq, upper, "upper");
      if (family !== "unknown") {
        knownTrigramCounts.set(lower, (knownTrigramCounts.get(lower) ?? 0) + 1);
        knownTrigramCounts.set(upper, (knownTrigramCounts.get(upper) ?? 0) + 1);
      }
    }

    if (entry.cast.becoming !== null) {
      addPair(transformations, entry.cast.primary, entry.cast.becoming, entry.date);
    }

    addStructuralEcho(structural, { kind: "nuclear", kw: entry.cast.nuclear }, entry.date);
    addStructuralEcho(structural, { kind: "polarity", kw: entry.cast.polarity }, entry.date);
    addStructuralEcho(structural, { kind: "mirror", kw: entry.cast.mirror }, entry.date);
    const pair = kingWenPair(entry.cast.primary);
    addStructuralEcho(
      structural,
      { kind: "kingWenPair", pairStart: pair[0], pairEnd: pair[1] },
      entry.date,
    );
  }

  const total = entries.length;
  const fieldCounts: number[] = new Array(64).fill(0);
  for (const [kw, f] of freq) {
    if (kw >= 1 && kw <= 64) fieldCounts[kw - 1] = f.count;
  }
  const field: FieldSummary = {
    counts: fieldCounts,
    maxCount: fieldCounts.reduce((m, c) => Math.max(m, c), 0),
    recent: recentEntry?.cast.primary ?? null,
  };
  // Uniform over 64: both methods give P(yang line)=1/2 (see LINE_PROBABILITIES),
  // so every known cast lands on one of 64 equally-likely primaries → known/64.
  const expectedHexagramCount = methodCounts.known > 0 ? methodCounts.known / 64 : null;
  const topHexagrams: HexagramFrequency[] = [...freq.entries()]
    .map(([kw, f]) => {
      const known = knownFreq.get(kw)?.count ?? 0;
      return {
        kw,
        count: f.count,
        knownCount: known,
        lastDate: f.lastDate,
        share: total > 0 ? f.count / total : 0,
        ...comparison(known, expectedHexagramCount),
      };
    })
    .sort((a, b) => b.count - a.count || nullableDesc(a.lift, b.lift) || a.kw - b.kw)
    .slice(0, topN);

  const movingLines: MovingLineFrequency[] = lineCounts.map((count, i) => ({
    position: i + 1,
    count,
    knownCount: knownLineCounts[i],
    share: totalMovingLines > 0 ? count / totalMovingLines : 0,
    // P(line moves)=1/4 for both methods → expected per position = known/4.
    ...comparison(knownLineCounts[i], methodCounts.known / 4),
  }));

  const movingLineCounts: MovingLineCountBin[] = movingCountBins.map((count, movingLines) => ({
    movingLines,
    count,
    knownCount: knownMovingCountBins[movingLines],
    share: total > 0 ? count / total : 0,
    ...comparison(knownMovingCountBins[movingLines], methodCounts.known * MOVING_COUNT_PROBABILITIES[movingLines]),
  }));

  // Counts are descriptive (all readings); the chance comparison rests on the
  // method-marked subset, like the per-hexagram expectation — uniform 1/8 per
  // trigram requires P(yang)=1/2, a property of the method, so legacy/unknown
  // readings must not silently participate in expected/lift.
  const expectedTrigramCount = methodCounts.known > 0 ? (methodCounts.known * 2) / 8 : 0;
  const totalTrigramAppearances = total * 2;
  const topTrigrams: TrigramFrequency[] = [...trigramFreq.entries()]
    .map(([index, t]) => {
      const knownCount = knownTrigramCounts.get(index) ?? 0;
      return {
        index,
        count: t.count,
        upperCount: t.upperCount,
        lowerCount: t.lowerCount,
        knownCount,
        share: totalTrigramAppearances > 0 ? t.count / totalTrigramAppearances : 0,
        expected: expectedTrigramCount,
        lift: expectedTrigramCount > 0 ? knownCount / expectedTrigramCount : null,
      };
    })
    .sort((a, b) => b.count - a.count || nullableDesc(a.lift, b.lift) || a.index - b.index)
    .slice(0, topN);

  const chronological = [...entries].sort(compareEntryTime);
  const transitions = new Map<string, { from: number; to: number; count: number; lastDate: string }>();
  const hammingCounts = [0, 0, 0, 0, 0, 0, 0];
  let hammingTotal = 0;
  let hammingMax = 0;
  for (let i = 1; i < chronological.length; i++) {
    addPair(
      transitions,
      chronological[i - 1].cast.primary,
      chronological[i].cast.primary,
      chronological[i].date,
    );
    const distance = hammingDistance(chronological[i - 1].cast.primary, chronological[i].cast.primary);
    hammingCounts[distance]++;
    hammingTotal += distance;
    if (distance > hammingMax) hammingMax = distance;
  }

  return {
    total,
    thisMonth,
    baseline: {
      methods: methodCounts,
      oldYin: { value: 6, ...comparison(observedOldYin, expectedOldYin) },
      oldYang: { value: 9, ...comparison(observedOldYang, expectedOldYang) },
      primaryExpectedPerHexagram: expectedHexagramCount,
    },
    cadence: computeCadence(entries, today),
    timeOfDay:
      timestampedCount >= PHASE_MIN_TIMESTAMPED
        ? { counts: phaseCounts, timestamped: timestampedCount }
        : null,
    diversity: computeDiversity(
      [...freq.values()].map((f) => f.count),
      total,
      [...knownFreq.values()].map((f) => f.count),
      methodCounts.known,
    ),
    field,
    lineBalance: { yang: yangLines, yin: yinLines },
    topHexagrams,
    movingLines,
    movingLineCounts,
    topTrigrams,
    topTransformations: pairList(transformations, Math.max(3, Math.min(topN, 5))),
    topTransitions: pairList(transitions, Math.max(3, Math.min(topN, 5))),
    topStructuralEchoes: structuralEchoList(structural, Math.max(4, Math.min(topN + 2, 7))),
    hammingDrift: hammingDrift(hammingCounts, hammingTotal, hammingMax),
  };
}

/** Descending sort comparator that sinks nulls to the bottom (used for lift). */
function nullableDesc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}
