// Pure-derivation tests for computeJournalPatterns — co-located with the module
// after it moved here from the terminal package. The terminal suite keeps the
// rendering tests (the 觀象 pane); this suite owns the data contract.

import { describe, test, expect } from "bun:test";
import type { Cast, Line, HistoryEntry } from "../types.js";
import { computeJournalPatterns } from "../journal/patterns.js";

function makeLine(value: 6 | 7 | 8 | 9): Line {
  return {
    value,
    isYang: value === 7 || value === 9,
    isChanging: value === 6 || value === 9,
  };
}

function makeCast(primary: number, becoming: number | null = null, changing: number[] = []): Cast {
  return {
    lines: [1, 2, 3, 4, 5, 6].map((pos) =>
      changing.includes(pos)
        ? makeLine(pos % 2 === 0 ? 6 : 9)
        : makeLine(pos % 2 === 0 ? 8 : 7),
    ),
    primary,
    becoming,
    changingPositions: changing,
    nuclear: 1,
    polarity: 2,
    mirror: 1,
    diagonal: 2,
  };
}

function makeEntry(date: string, primary: number, opts: Partial<HistoryEntry> = {}): HistoryEntry {
  return { date, cast: makeCast(primary), ...opts };
}

describe("computeJournalPatterns", () => {
  test("derives totals, cadence, diversity, frequency, and line distributions", () => {
    const entries = [
      makeEntry("2026-03-01", 39, { cast: makeCast(39, 8, [5, 2]), method: "coin" }),
      makeEntry("2026-03-08", 39, { cast: makeCast(39, 15, [5]), method: "yarrow" }),
      makeEntry("2026-04-02", 1),
    ];
    const p = computeJournalPatterns(entries, "2026-04-15");
    expect(p.total).toBe(3);
    expect(p.thisMonth).toBe(1);
    expect(p.baseline.methods).toEqual({ coin: 1, yarrow: 1, unknown: 1, known: 2, total: 3 });
    expect(p.baseline.oldYin.observed).toBe(1);
    expect(p.baseline.oldYin.expected).toBeCloseTo(1.125, 4);
    expect(p.baseline.oldYang.observed).toBe(2);
    expect(p.baseline.oldYang.expected).toBeCloseTo(1.875, 4);
    expect(p.cadence).toMatchObject({
      firstDate: "2026-03-01",
      lastDate: "2026-04-02",
      spanDays: 33,
      activeDays: 3,
      recent30: 1,
      medianGapDays: 16,
      longestGapDays: 25,
      idleDays: 13,
    });
    expect(p.cadence?.castsPerActiveDay).toBe(1);
    expect(p.diversity.distinctHexagrams).toBe(2);
    expect(p.diversity.entropyBits).toBeCloseTo(0.918, 3);
    expect(p.diversity.normalizedEntropy).toBeCloseTo(0.579, 3);
    expect(p.diversity.topShare).toBeCloseTo(2 / 3, 3);
    expect(p.diversity.knownDistinctHexagrams).toBe(1);
    expect(p.diversity.observedRepeats).toBe(1);
    expect(p.diversity.expectedRepeats).toBeCloseTo(0.0156, 4);
    expect(p.topHexagrams[0]).toMatchObject({ kw: 39, count: 2, lastDate: "2026-03-08" });
    expect(p.topHexagrams[0].knownCount).toBe(2);
    expect(p.topHexagrams[0].share).toBeCloseTo(2 / 3, 3);
    expect(p.topHexagrams[0].lift).toBeCloseTo(64, 3);
    expect(p.topHexagrams[1]).toMatchObject({ kw: 1, count: 1, lastDate: "2026-04-02" });
    expect(p.topHexagrams[1].knownCount).toBe(0);
    expect(p.movingLines.map((line) => line.count)).toEqual([0, 1, 0, 0, 2, 0]);
    expect(p.movingLines.map((line) => line.knownCount)).toEqual([0, 1, 0, 0, 2, 0]);
    expect(p.movingLineCounts.map((bin) => bin.count)).toEqual([1, 1, 1, 0, 0, 0, 0]);
    expect(p.movingLineCounts.map((bin) => bin.knownCount)).toEqual([0, 1, 1, 0, 0, 0, 0]);
    expect(p.movingLine).toEqual({ position: 5, count: 2 });
    expect(p.topTransformations.map((pair) => [pair.from, pair.to, pair.count])).toEqual([
      [39, 8, 1],
      [39, 15, 1],
    ]);
    expect(p.topTransitions.map((pair) => [pair.from, pair.to, pair.count])).toEqual([
      [39, 1, 1],
      [39, 39, 1],
    ]);
    expect(p.topTrigrams.length).toBeGreaterThan(0);
    expect(p.topTrigrams[0].expected).toBeCloseTo(6 / 8, 4);
    expect(p.topStructuralEchoes.length).toBeGreaterThan(0);
    expect(p.hammingDrift?.transitions).toBe(2);
    // The dense field behind the 8×8 grid: every KW slot, all methods counted.
    expect(p.field.counts).toHaveLength(64);
    expect(p.field.counts[38]).toBe(2); // KW 39
    expect(p.field.counts[0]).toBe(1); // KW 1
    expect(p.field.counts.reduce((sum, c) => sum + c, 0)).toBe(3);
    expect(p.field.maxCount).toBe(2);
    expect(p.field.recent).toBe(1); // latest by time key: 2026-04-02, primary kw1
    // 兩儀 — every line's polarity, all 3 casts × 6 lines = 18 lines. makeCast
    // draws yang on odd positions (3) and yin on even (3) → 9 each per cast.
    expect(p.lineBalance.yang + p.lineBalance.yin).toBe(18);
    expect(p.lineBalance.yang).toBe(9);
    expect(p.lineBalance.yin).toBe(9);
  });

  test("empty journal and no moving lines stay calm", () => {
    const empty = computeJournalPatterns([], "2026-04-15");
    expect(empty.total).toBe(0);
    expect(empty.thisMonth).toBe(0);
    expect(empty.cadence).toBeNull();
    expect(empty.diversity).toEqual({
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
    });
    expect(empty.topHexagrams).toEqual([]);
    expect(empty.movingLine).toBeNull();
    expect(empty.field.counts).toHaveLength(64);
    expect(empty.field.maxCount).toBe(0);
    expect(empty.field.recent).toBeNull();
    const p = computeJournalPatterns([makeEntry("2026-04-01", 2)], "2026-04-15");
    expect(p.movingLine).toBeNull();
    expect(p.movingLineCounts[0]).toMatchObject({ movingLines: 0, count: 1, share: 1 });
  });

  test("old-line observations count all entries; expectation stays method-marked", () => {
    // Two casts with a moving line each: one coin-marked, one unmarked.
    // Observed 6s/9s count both; expected rests only on the marked cast.
    const entries = [
      makeEntry("2026-03-01", 39, { cast: makeCast(39, 8, [2]), method: "coin" }), // 6 at pos2
      makeEntry("2026-03-02", 39, { cast: makeCast(39, 8, [2]) }), // unmarked, 6 at pos2
    ];
    const p = computeJournalPatterns(entries, "2026-04-15");
    expect(p.baseline.oldYin.observed).toBe(2); // both entries, not just the marked one
    expect(p.baseline.oldYang.observed).toBe(0);
    // Expectation is one coin cast worth of old-yin chance (6 lines × 1/8).
    expect(p.baseline.oldYin.expected).toBeCloseTo(0.75, 4);
    expect(p.baseline.methods.known).toBe(1);
  });

  test("frequency ties break by lower KW; top list caps at five", () => {
    const entries = [1, 2, 3, 4, 5, 6, 6].map((kw, i) =>
      makeEntry(`2026-03-0${i + 1}`, kw),
    );
    const p = computeJournalPatterns(entries, "2026-04-15");
    expect(p.topHexagrams).toHaveLength(5);
    expect(p.topHexagrams[0].kw).toBe(6);
    expect(p.topHexagrams.slice(1).map((h) => h.kw)).toEqual([1, 2, 3, 4]);
  });

  test("a malformed entry missing its lines is tolerated, not fatal", () => {
    // Defense-in-depth: a record without cast.lines (pre-format/corrupt) counts
    // toward totals/field but contributes no line tallies, never throwing.
    const noLines = {
      date: "2026-03-02",
      cast: { primary: 5, becoming: null, changingPositions: [], nuclear: 1, polarity: 1, mirror: 1, diagonal: 1 },
    } as unknown as HistoryEntry;
    const entries = [makeEntry("2026-03-01", 39, { method: "coin" }), noLines];
    expect(() => computeJournalPatterns(entries, "2026-04-15")).not.toThrow();
    const p = computeJournalPatterns(entries, "2026-04-15");
    expect(p.total).toBe(2);
    expect(p.field.counts[4]).toBe(1); // KW 5 still counted in the field
    // The lines-less entry adds nothing to the 兩儀 balance (only the good cast).
    expect(p.lineBalance.yang + p.lineBalance.yin).toBe(6);
  });
});
