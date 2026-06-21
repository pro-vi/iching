// journal patterns — the data contract. Extracted from patterns.ts so the
// ~20-type surface reads as one piece, separate from the derivation logic.
// Pure types (no runtime), re-exported from patterns.ts to keep @iching/core's
// public surface unchanged.

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
  /** All-readings appearances across primary upper+lower positions (descriptive). */
  count: number;
  upperCount: number;
  lowerCount: number;
  /** Appearances among method-marked readings — the basis the comparison rests on. */
  knownCount: number;
  /** Share of all primary upper/lower trigram appearances (all readings). */
  share: number;
  /**
   * Method-marked appearance expectation per trigram: (known * 2) / 8. Trigram
   * uniformity (each 1/8) needs P(yang line)=1/2, which is a property of the
   * casting METHOD (true for coin and yarrow) — so, like the per-hexagram
   * expectation, it must rest on the known subset, not all readings.
   */
  expected: number;
  /** knownCount / expected; null when there is no method-marked baseline. */
  lift: number | null;
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

/**
 * 時 — the phase of day at which readings were cast, a quiet mirror of when
 * the questions tend to arise. A plain distribution, never a metric: no
 * streak, no target, no claim that the hour bears on the reading.
 *
 * Rests ONLY on readings that carry a real local timestamp. Legacy/imported
 * entries without one are excluded rather than defaulted to midnight — a false
 * spike would be worse than silence — so `timestamped` (= sum of `counts`)
 * names the honest population the shape is drawn from.
 */
export interface PhaseDistribution {
  /** Counts per phase, in order: [晨 dawn, 晝 day, 暮 dusk, 夜 night]. */
  counts: [number, number, number, number];
  /** Readings carrying a real timestamp — the population behind the shape. */
  timestamped: number;
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
  /** 時 — phase-of-day distribution over timestamped readings (null if too few). */
  timeOfDay: PhaseDistribution | null;
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
