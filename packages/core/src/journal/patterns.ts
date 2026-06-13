// journal patterns — quiet observation over the journal's entries.
//
// Pure derivation: distribution, cadence, lift, structure, and transitions.
// It stays descriptive: counts and rates over what arrived, never prediction.
// Lives in core (pure domain logic) so both the TUI pane and the CLI can read it.

import { GUA } from "../data/gua.js";
import { trigramIndex } from "../identify/structure.js";
import type { CastMethod, HistoryEntry, LineValue } from "../types.js";

export type MethodFamily = "coin" | "yarrow" | "unknown";

export interface MethodFamilyCounts {
  coin: number;
  yarrow: number;
  unknown: number;
  known: number;
  total: number;
}

export interface ExpectedComparison {
  observed: number;
  expected: number;
  lift: number | null;
  residual: number | null;
}

export interface DirectionComparison extends ExpectedComparison {
  value: 6 | 9;
}

export interface BaselineSummary {
  methods: MethodFamilyCounts;
  oldYin: DirectionComparison;
  oldYang: DirectionComparison;
  primaryExpectedPerHexagram: number | null;
}

export interface HexagramFrequency {
  kw: number;
  count: number;
  /** Count among entries whose cast method has a known probability baseline. */
  knownCount: number;
  lastDate: string;
  /** Share of all readings whose primary hexagram is `kw`. */
  share: number;
  /** Known-method expectation for this hexagram, excluding legacy unknowns. */
  expected: number;
  /** knownCount divided by expected; null when no known-method baseline exists. */
  lift: number | null;
  /** Pearson-style residual against expected; null when no baseline exists. */
  residual: number | null;
}

export interface MovingLineFrequency {
  position: number;
  count: number;
  /** Count among entries whose cast method has a known probability baseline. */
  knownCount: number;
  /** Share of all moving-line appearances. */
  share: number;
  /** Known-method expectation for this line position. */
  expected: number;
  lift: number | null;
  residual: number | null;
}

export interface MovingLineCountBin {
  movingLines: number;
  count: number;
  /** Count among entries whose cast method has a known probability baseline. */
  knownCount: number;
  /** Share of all readings with this many moving lines. */
  share: number;
  /** Known-method expectation for this moving-line count. */
  expected: number;
  lift: number | null;
  residual: number | null;
}

export interface TrigramFrequency {
  index: number;
  count: number;
  upperCount: number;
  lowerCount: number;
  /** Share of all primary upper/lower trigram appearances. */
  share: number;
  /** Count divided by the uniform 1/8 expectation for trigram appearances. */
  lift: number;
  /** Uniform appearance expectation per trigram: (total * 2) / 8. */
  expected: number;
}

export interface PairFrequency {
  from: number;
  to: number;
  count: number;
  lastDate: string;
  share: number;
}

export interface CadenceSummary {
  firstDate: string;
  lastDate: string;
  spanDays: number;
  activeDays: number;
  recent30: number;
  castsPerActiveDay: number;
  medianGapDays: number | null;
  longestGapDays: number | null;
  idleDays: number | null;
}

export interface DiversitySummary {
  distinctHexagrams: number;
  knownDistinctHexagrams: number;
  entropyBits: number;
  maxEntropyBits: number;
  normalizedEntropy: number;
  topShare: number;
  concentration: number;
  expectedDistinctHexagrams: number | null;
  observedRepeats: number;
  expectedRepeats: number | null;
  repeatLift: number | null;
}

export type StructuralEchoKind = "nuclear" | "polarity" | "mirror" | "kingWenPair";

export interface StructuralEcho {
  kind: StructuralEchoKind;
  count: number;
  lastDate: string;
  share: number;
  kw?: number;
  pairStart?: number;
  pairEnd?: number;
}

export interface HammingDistanceBin {
  distance: number;
  count: number;
  share: number;
}

export interface HammingDriftSummary {
  transitions: number;
  mean: number;
  max: number;
  distribution: HammingDistanceBin[];
}

/**
 * Dense primary-hexagram counts over the whole field of 64 — the data behind
 * the patterns pane's 8×8 grid. All methods count, legacy unknowns included:
 * the field shows where readings landed, not a probability claim.
 */
export interface FieldSummary {
  /** counts[i] = readings whose cast.primary === i + 1 (King Wen order). */
  counts: number[];
  /** Math.max(0, ...counts). */
  maxCount: number;
  /** Primary KW of the most recent reading — where the field was last lit. */
  recent: number | null;
}

/**
 * 兩儀 — the yang/yin balance across every line of every reading. All entries
 * count (a line's polarity is recorded regardless of method). 6 lines per cast.
 */
export interface LineBalanceSummary {
  yang: number;
  yin: number;
}

export interface JournalPatterns {
  /** Total readings loaded. */
  total: number;
  /** Readings whose date falls in today's month. */
  thisMonth: number;
  /** Method-aware baseline counts and changing-line direction expectations. */
  baseline: BaselineSummary;
  /** Date-window and sampling cadence over active casting days. */
  cadence: CadenceSummary | null;
  /** Primary-hexagram diversity and concentration. */
  diversity: DiversitySummary;
  /** Dense counts across all 64 hexagrams (the 8×8 field). */
  field: FieldSummary;
  /** 兩儀 — yang vs yin lines drawn across every reading. */
  lineBalance: LineBalanceSummary;
  /** Most-seen primary hexagrams, count desc then KW asc. */
  topHexagrams: HexagramFrequency[];
  /** Moving-line position distribution (1–6). */
  movingLines: MovingLineFrequency[];
  /** Distribution of how many lines move in each cast (0–6). */
  movingLineCounts: MovingLineCountBin[];
  /** Most common changing-line position (1–6), or null when nothing moved. */
  movingLine: { position: number; count: number } | null;
  /** Most common trigrams across primary upper/lower positions. */
  topTrigrams: TrigramFrequency[];
  /** Most common primary → becoming transformations. */
  topTransformations: PairFrequency[];
  /** Most common chronological primary → next-primary transitions. */
  topTransitions: PairFrequency[];
  /** Repeated derived/structural relationships over the journal. */
  topStructuralEchoes: StructuralEcho[];
  /** Chronological primary → next-primary Hamming-distance drift. */
  hammingDrift: HammingDriftSummary | null;
}

const LINE_PROBABILITIES: Record<Exclude<MethodFamily, "unknown">, Record<LineValue, number>> = {
  coin: { 6: 1 / 8, 7: 3 / 8, 8: 3 / 8, 9: 1 / 8 },
  yarrow: { 6: 1 / 16, 7: 5 / 16, 8: 7 / 16, 9: 3 / 16 },
};

const MOVING_COUNT_PROBABILITIES = [
  729 / 4096,
  1458 / 4096,
  1215 / 4096,
  540 / 4096,
  135 / 4096,
  18 / 4096,
  1 / 4096,
] as const;

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
  const knownFreq = new Map<number, { count: number; lastDate: string }>();
  const lineCounts = [0, 0, 0, 0, 0, 0];
  const knownLineCounts = [0, 0, 0, 0, 0, 0];
  const movingCountBins = [0, 0, 0, 0, 0, 0, 0];
  const knownMovingCountBins = [0, 0, 0, 0, 0, 0, 0];
  const trigramFreq = new Map<number, { count: number; upperCount: number; lowerCount: number }>();
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
  let recentKey = "";
  let recentKw: number | null = null;

  for (const entry of entries) {
    const family = methodFamily(entry.method);
    methodCounts[family]++;
    methodCounts.total++;
    if (family !== "unknown") methodCounts.known++;

    if (entry.date.startsWith(month)) thisMonth++;

    // Most recent reading by the same time key the chronological sort uses.
    const tkey = entryTimeKey(entry);
    if (recentKw === null || tkey >= recentKey) {
      recentKey = tkey;
      recentKw = entry.cast.primary;
    }

    const f = freq.get(entry.cast.primary) ?? { count: 0, lastDate: "" };
    f.count++;
    if (entry.date > f.lastDate) f.lastDate = entry.date;
    freq.set(entry.cast.primary, f);

    const changing = entry.cast.changingPositions ?? [];
    if (changing.length <= 6) movingCountBins[changing.length]++;
    totalMovingLines += changing.length;
    for (const pos of changing) {
      if (pos >= 1 && pos <= 6) lineCounts[pos - 1]++;
    }
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

      if (changing.length <= 6) knownMovingCountBins[changing.length]++;
      for (const pos of changing) {
        if (pos >= 1 && pos <= 6) knownLineCounts[pos - 1]++;
      }
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
    recent: recentKw,
  };
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
    ...comparison(knownLineCounts[i], methodCounts.known / 4),
  }));

  let movingLine: JournalPatterns["movingLine"] = null;
  for (let i = 0; i < 6; i++) {
    if (lineCounts[i] > 0 && (movingLine === null || lineCounts[i] > movingLine.count)) {
      movingLine = { position: i + 1, count: lineCounts[i] };
    }
  }

  const movingLineCounts: MovingLineCountBin[] = movingCountBins.map((count, movingLines) => ({
    movingLines,
    count,
    knownCount: knownMovingCountBins[movingLines],
    share: total > 0 ? count / total : 0,
    ...comparison(knownMovingCountBins[movingLines], methodCounts.known * MOVING_COUNT_PROBABILITIES[movingLines]),
  }));

  const expectedTrigramCount = total > 0 ? (total * 2) / 8 : 0;
  const totalTrigramAppearances = total * 2;
  const topTrigrams: TrigramFrequency[] = [...trigramFreq.entries()]
    .map(([index, t]) => ({
      index,
      count: t.count,
      upperCount: t.upperCount,
      lowerCount: t.lowerCount,
      share: totalTrigramAppearances > 0 ? t.count / totalTrigramAppearances : 0,
      lift: expectedTrigramCount > 0 ? t.count / expectedTrigramCount : 0,
      expected: expectedTrigramCount,
    }))
    .sort((a, b) => b.count - a.count || b.lift - a.lift || a.index - b.index)
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
    movingLine,
    topTrigrams,
    topTransformations: pairList(transformations, Math.max(3, Math.min(topN, 5))),
    topTransitions: pairList(transitions, Math.max(3, Math.min(topN, 5))),
    topStructuralEchoes: structuralEchoList(structural, Math.max(4, Math.min(topN + 2, 7))),
    hammingDrift: hammingDrift(hammingCounts, hammingTotal, hammingMax),
  };
}

function methodFamily(method: CastMethod | undefined): MethodFamily {
  if (method === "coin" || method === "coin-manual") return "coin";
  if (method === "yarrow" || method === "yarrow-manual") return "yarrow";
  return "unknown";
}

function comparison(observed: number, expected: number | null): ExpectedComparison {
  if (expected === null) return { observed, expected: 0, lift: null, residual: null };
  if (expected <= 0) return { observed, expected, lift: null, residual: null };
  return {
    observed,
    expected,
    lift: observed / expected,
    residual: (observed - expected) / Math.sqrt(expected),
  };
}

function nullableDesc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function addTrigram(
  freq: Map<number, { count: number; upperCount: number; lowerCount: number }>,
  index: number,
  role: "upper" | "lower",
): void {
  const current = freq.get(index) ?? { count: 0, upperCount: 0, lowerCount: 0 };
  current.count++;
  if (role === "upper") current.upperCount++;
  else current.lowerCount++;
  freq.set(index, current);
}

function addPair(
  pairs: Map<string, { from: number; to: number; count: number; lastDate: string }>,
  from: number,
  to: number,
  date: string,
): void {
  const key = `${from}->${to}`;
  const current = pairs.get(key) ?? { from, to, count: 0, lastDate: "" };
  current.count++;
  if (date > current.lastDate) current.lastDate = date;
  pairs.set(key, current);
}

function pairList(
  pairs: Map<string, { from: number; to: number; count: number; lastDate: string }>,
  limit: number,
): PairFrequency[] {
  const total = [...pairs.values()].reduce((sum, pair) => sum + pair.count, 0);
  return [...pairs.values()]
    .map((pair) => ({ ...pair, share: total > 0 ? pair.count / total : 0 }))
    .sort((a, b) => b.count - a.count || a.from - b.from || a.to - b.to)
    .slice(0, limit);
}

function computeDiversity(
  counts: number[],
  total: number,
  knownCounts: number[],
  knownTotal: number,
): DiversitySummary {
  if (total === 0) {
    return {
      distinctHexagrams: 0,
      knownDistinctHexagrams: 0,
      entropyBits: 0,
      maxEntropyBits: 0,
      normalizedEntropy: 0,
      topShare: 0,
      concentration: 0,
      expectedDistinctHexagrams: null,
      observedRepeats: 0,
      expectedRepeats: null,
      repeatLift: null,
    };
  }

  let entropyBits = 0;
  let concentration = 0;
  let maxCount = 0;
  for (const count of counts) {
    const p = count / total;
    entropyBits -= p * Math.log2(p);
    concentration += p * p;
    if (count > maxCount) maxCount = count;
  }
  const maxEntropyBits = Math.log2(Math.min(64, total));
  const expectedDistinctHexagrams =
    knownTotal > 0 ? 64 * (1 - (63 / 64) ** knownTotal) : null;
  const observedRepeats = knownTotal - knownCounts.length;
  const expectedRepeats =
    expectedDistinctHexagrams === null ? null : knownTotal - expectedDistinctHexagrams;
  return {
    distinctHexagrams: counts.length,
    knownDistinctHexagrams: knownCounts.length,
    entropyBits,
    maxEntropyBits,
    normalizedEntropy: maxEntropyBits > 0 ? entropyBits / maxEntropyBits : 0,
    topShare: maxCount / total,
    concentration,
    expectedDistinctHexagrams,
    observedRepeats,
    expectedRepeats,
    repeatLift: comparison(observedRepeats, expectedRepeats).lift,
  };
}

function computeCadence(entries: HistoryEntry[], today: string): CadenceSummary | null {
  if (entries.length === 0) return null;

  const ordinals = new Map<number, string>();
  let recent30 = 0;
  const todayOrdinal = dayOrdinal(today);
  for (const entry of entries) {
    const ord = dayOrdinal(entry.date);
    if (ord === null) continue;
    ordinals.set(ord, entry.date);
    if (todayOrdinal !== null && ord >= todayOrdinal - 29 && ord <= todayOrdinal) recent30++;
  }

  const activeOrdinals = [...ordinals.keys()].sort((a, b) => a - b);
  if (activeOrdinals.length === 0) {
    return {
      firstDate: "",
      lastDate: "",
      spanDays: 0,
      activeDays: 0,
      recent30,
      castsPerActiveDay: 0,
      medianGapDays: null,
      longestGapDays: null,
      idleDays: null,
    };
  }

  const first = activeOrdinals[0];
  const last = activeOrdinals[activeOrdinals.length - 1];
  const gaps: number[] = [];
  for (let i = 1; i < activeOrdinals.length; i++) {
    gaps.push(activeOrdinals[i] - activeOrdinals[i - 1]);
  }

  return {
    firstDate: ordinals.get(first) ?? "",
    lastDate: ordinals.get(last) ?? "",
    spanDays: last - first + 1,
    activeDays: activeOrdinals.length,
    recent30,
    castsPerActiveDay: entries.length / activeOrdinals.length,
    medianGapDays: gaps.length > 0 ? median(gaps) : null,
    longestGapDays: gaps.length > 0 ? Math.max(...gaps) : null,
    idleDays: todayOrdinal !== null ? Math.max(0, todayOrdinal - last) : null,
  };
}

function compareEntryTime(a: HistoryEntry, b: HistoryEntry): number {
  return entryTimeKey(a).localeCompare(entryTimeKey(b));
}

function entryTimeKey(entry: HistoryEntry): string {
  return entry.timestamp ?? `${entry.date}T00:00:00.000Z`;
}

function dayOrdinal(date: string): number | null {
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

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function addStructuralEcho(
  echoes: Map<string, StructuralEcho>,
  echo: Pick<StructuralEcho, "kind" | "kw" | "pairStart" | "pairEnd">,
  date: string,
): void {
  const key = echo.kind === "kingWenPair"
    ? `${echo.kind}:${echo.pairStart}-${echo.pairEnd}`
    : `${echo.kind}:${echo.kw}`;
  const current = echoes.get(key) ?? { ...echo, count: 0, lastDate: "", share: 0 };
  current.count++;
  if (date > current.lastDate) current.lastDate = date;
  echoes.set(key, current);
}

function structuralEchoList(echoes: Map<string, StructuralEcho>, limit: number): StructuralEcho[] {
  const byKind: Record<StructuralEchoKind, number> = {
    nuclear: 0,
    polarity: 1,
    mirror: 2,
    kingWenPair: 3,
  };
  const total = [...echoes.values()].reduce((sum, echo) => sum + echo.count, 0);
  return [...echoes.values()]
    .map((echo) => ({ ...echo, share: total > 0 ? echo.count / total : 0 }))
    .sort((a, b) =>
      b.count - a.count ||
      byKind[a.kind] - byKind[b.kind] ||
      (a.kw ?? a.pairStart ?? 0) - (b.kw ?? b.pairStart ?? 0)
    )
    .slice(0, limit);
}

function kingWenPair(kw: number): [number, number] {
  const start = kw % 2 === 1 ? kw : kw - 1;
  return [start, start + 1];
}

function hammingDistance(aKw: number, bKw: number): number {
  const a = GUA[aKw - 1]?.l;
  const b = GUA[bKw - 1]?.l;
  if (!a || !b) return 0;
  let distance = 0;
  for (let i = 0; i < 6; i++) {
    if (a[i] !== b[i]) distance++;
  }
  return distance;
}

function hammingDrift(
  counts: number[],
  totalDistance: number,
  maxDistance: number,
): HammingDriftSummary | null {
  const transitions = counts.reduce((sum, count) => sum + count, 0);
  if (transitions === 0) return null;
  return {
    transitions,
    mean: totalDistance / transitions,
    max: maxDistance,
    distribution: counts.map((count, distance) => ({
      distance,
      count,
      share: count / transitions,
    })),
  };
}
