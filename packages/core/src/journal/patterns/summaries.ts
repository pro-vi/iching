// patterns/summaries.ts — accumulate-then-emit for each journal summary.
//
// Each summary has a small accumulator the main loop calls per entry (addPair,
// addTrigram, addStructuralEcho) paired with the builder that emits the ranked
// list at the end (pairList, structuralEchoList), plus the self-contained
// summaries computed in one shot (diversity, cadence, hamming drift). Kept
// together so a summary's growth and its emission are read side by side. Pure.

import type { HistoryEntry } from "../../types.js";
import type {
  CadenceSummary,
  DiversitySummary,
  HammingDriftSummary,
  PairFrequency,
  StructuralEcho,
  StructuralEchoKind,
} from "./types.js";
import { GUA } from "../../data/gua.js";
import { comparison } from "./chance.js";
import { dayOrdinal } from "./time.js";
import { shareOf } from "./share.js";

export function addTrigram(
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

export function addPair(
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

export function pairList(
  pairs: Map<string, { from: number; to: number; count: number; lastDate: string }>,
  limit: number,
): PairFrequency[] {
  const total = [...pairs.values()].reduce((sum, pair) => sum + pair.count, 0);
  return [...pairs.values()]
    .map((pair) => ({ ...pair, share: shareOf(pair.count, total) }))
    .sort((a, b) => b.count - a.count || a.from - b.from || a.to - b.to)
    .slice(0, limit);
}

export function computeDiversity(
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
  // Sum in a canonical (ascending) order. `counts` arrives in first-seen order,
  // which follows the caller's entry order — and float addition isn't
  // associative, so an unsorted sum makes entropyBits/concentration depend on
  // whether the TUI (newest-first) or CLI (append-order) called. Sorting makes
  // the figures byte-identical across surfaces; ascending also minimises
  // rounding by adding the smallest terms first.
  for (const count of [...counts].sort((a, b) => a - b)) {
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
    normalizedEntropy: shareOf(entropyBits, maxEntropyBits),
    topShare: maxCount / total,
    concentration,
    expectedDistinctHexagrams,
    observedRepeats,
    expectedRepeats,
    repeatLift: comparison(observedRepeats, expectedRepeats).lift,
  };
}

export function computeCadence(entries: HistoryEntry[], today: string): CadenceSummary | null {
  if (entries.length === 0) return null;

  const ordinals = new Map<number, string>();
  let recent30 = 0;
  let datedCasts = 0; // readings whose date parses — the population the day base counts
  const todayOrdinal = dayOrdinal(today);
  for (const entry of entries) {
    const ord = dayOrdinal(entry.date);
    if (ord === null) continue;
    datedCasts++;
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
    castsPerActiveDay: datedCasts / activeOrdinals.length,
    medianGapDays: gaps.length > 0 ? median(gaps) : null,
    longestGapDays: gaps.length > 0 ? Math.max(...gaps) : null,
    idleDays: todayOrdinal !== null ? Math.max(0, todayOrdinal - last) : null,
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function addStructuralEcho(
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

export function structuralEchoList(echoes: Map<string, StructuralEcho>, limit: number): StructuralEcho[] {
  const byKind: Record<StructuralEchoKind, number> = {
    nuclear: 0,
    polarity: 1,
    mirror: 2,
    kingWenPair: 3,
  };
  const total = [...echoes.values()].reduce((sum, echo) => sum + echo.count, 0);
  return [...echoes.values()]
    .map((echo) => ({ ...echo, share: shareOf(echo.count, total) }))
    .sort((a, b) =>
      b.count - a.count ||
      byKind[a.kind] - byKind[b.kind] ||
      (a.kw ?? a.pairStart ?? 0) - (b.kw ?? b.pairStart ?? 0)
    )
    .slice(0, limit);
}

export function kingWenPair(kw: number): [number, number] {
  const start = kw % 2 === 1 ? kw : kw - 1;
  return [start, start + 1];
}

export function hammingDistance(aKw: number, bKw: number): number {
  const a = GUA[aKw - 1]?.l;
  const b = GUA[bKw - 1]?.l;
  if (!a || !b) return 0;
  let distance = 0;
  for (let i = 0; i < 6; i++) {
    if (a[i] !== b[i]) distance++;
  }
  return distance;
}

export function hammingDrift(
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
