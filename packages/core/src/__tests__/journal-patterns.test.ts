// Pure-derivation tests for computeJournalPatterns — co-located with the module
// after it moved here from the terminal package. The terminal suite keeps the
// rendering tests (the 觀象 pane); this suite owns the data contract.

import { describe, test, expect } from "bun:test";
import type { Cast, Line, HistoryEntry } from "../types.js";
import { computeJournalPatterns, phaseOfHour, PHASE_MIN_TIMESTAMPED } from "../journal/patterns.js";

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

  test("old-line comparison stays same-basis: observed and expected are both method-marked", () => {
    // Two casts with one old-yin (6) each: one coin-marked, one unmarked. The
    // old-yang/yin row is a chance comparison, so observed counts ONLY the
    // method-marked cast — same basis as the expectation. (Counting the legacy
    // cast too would inflate the comparison against a method-only expectation.)
    const entries = [
      makeEntry("2026-03-01", 39, { cast: makeCast(39, 8, [2]), method: "coin" }), // 6 at pos2
      makeEntry("2026-03-02", 39, { cast: makeCast(39, 8, [2]) }), // unmarked, 6 at pos2
    ];
    const p = computeJournalPatterns(entries, "2026-04-15");
    expect(p.baseline.oldYin.observed).toBe(1); // the coin cast only, not the legacy one
    expect(p.baseline.oldYang.observed).toBe(0);
    // Expectation is one coin cast worth of old-yin chance (6 lines × 1/8).
    expect(p.baseline.oldYin.expected).toBeCloseTo(0.75, 4);
    expect(p.baseline.oldYin.lift).toBeCloseTo(1 / 0.75, 4); // same-basis ratio
    expect(p.baseline.methods.known).toBe(1);
    // The 兩儀 balance, by contrast, IS descriptive — both casts' lines count.
    expect(p.lineBalance.yang + p.lineBalance.yin).toBe(12);
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

  test("malformed changingPositions normalize so the two moving-line distributions agree", () => {
    // A hand-edited record can carry out-of-range / duplicate / >6 positions
    // (the store only checks integer-array). Normalizing to a unique 1–6 set
    // keeps the per-position tally (movingLines) and the per-cast bin
    // (movingLineCounts) over the SAME population — they must never disagree.
    const bad = (date: string, positions: number[]): HistoryEntry =>
      ({
        date,
        method: "coin",
        cast: {
          lines: [1, 2, 3, 4, 5, 6].map(() => makeLine(8)),
          primary: 1,
          becoming: null,
          changingPositions: positions,
          nuclear: 1,
          polarity: 1,
          mirror: 1,
          diagonal: 1,
        },
      }) as unknown as HistoryEntry;
    const entries = [
      bad("2026-03-01", [0, 3, 3, 99, -1, 7]), // → {3}: one moving line
      bad("2026-03-02", [1, 2, 3, 4, 5, 6, 3, 4]), // → {1..6}: six moving lines
    ];
    const p = computeJournalPatterns(entries, "2026-04-15");
    const perPosition = p.movingLines.reduce((a, l) => a + l.count, 0);
    const viaBins = p.movingLineCounts.reduce((a, b) => a + b.movingLines * b.count, 0);
    expect(perPosition).toBe(7); // 1 + 6
    expect(viaBins).toBe(perPosition); // the two distributions agree
    expect(p.movingLineCounts.reduce((a, b) => a + b.count, 0)).toBe(2); // every cast binned once
    expect(p.movingLineCounts[1].count).toBe(1); // the {3} cast → bin 1
    expect(p.movingLineCounts[6].count).toBe(1); // the {1..6} cast → bin 6
    // No position counted twice despite the duplicate 3s.
    expect(p.movingLines[2].count).toBe(2); // position 3 appears in both casts, once each
  });
});

describe("phaseOfHour — four even six-hour phases of the local day", () => {
  test("maps each hour 0–23 to 晨/午/暮/夜 at the 5/11/17/23 boundaries", () => {
    const expected: Array<[number, 0 | 1 | 2 | 3]> = [
      [0, 3], [4, 3], // 夜 night wraps midnight
      [5, 0], [10, 0], // 晨 dawn 5–10
      [11, 1], [16, 1], // 午 midday 11–16
      [17, 2], [22, 2], // 暮 dusk 17–22
      [23, 3], // 夜 again
    ];
    for (const [hour, phase] of expected) expect(phaseOfHour(hour)).toBe(phase);
    // The four phases partition all 24 hours exactly once.
    const tally = [0, 0, 0, 0];
    for (let h = 0; h < 24; h++) tally[phaseOfHour(h)]++;
    expect(tally).toEqual([6, 6, 6, 6]);
  });
});

describe("computeJournalPatterns — 時 phase-of-day distribution", () => {
  // Phase is bucketed by the LOCAL hour, so derive the expected phase the same
  // way the impl does (runtime tz) — keeps the assertion deterministic anywhere.
  const expectedPhase = (ts: string): number => phaseOfHour(new Date(ts).getHours());

  test("null below the timestamped floor, present at or above it", () => {
    const few = Array.from({ length: PHASE_MIN_TIMESTAMPED - 1 }, (_, i) =>
      makeEntry(`2026-03-0${i + 1}`, i + 1, { timestamp: `2026-03-0${i + 1}T14:00:00.000Z` }),
    );
    expect(computeJournalPatterns(few, "2026-04-15").timeOfDay).toBeNull();

    const enough = Array.from({ length: PHASE_MIN_TIMESTAMPED }, (_, i) =>
      makeEntry(`2026-03-0${i + 1}`, i + 1, { timestamp: `2026-03-0${i + 1}T14:00:00.000Z` }),
    );
    const tod = computeJournalPatterns(enough, "2026-04-15").timeOfDay;
    expect(tod).not.toBeNull();
    expect(tod!.timestamped).toBe(PHASE_MIN_TIMESTAMPED);
    expect(tod!.counts.reduce((a, b) => a + b, 0)).toBe(PHASE_MIN_TIMESTAMPED);
  });

  test("only timestamped entries count — legacy and invalid are excluded, not midnight-defaulted", () => {
    const entries: HistoryEntry[] = [
      makeEntry("2026-03-01", 1, { timestamp: "2026-03-01T07:00:00.000Z" }),
      makeEntry("2026-03-02", 2, { timestamp: "2026-03-02T13:00:00.000Z" }),
      makeEntry("2026-03-03", 3, { timestamp: "2026-03-03T19:00:00.000Z" }),
      makeEntry("2026-03-04", 4, { timestamp: "2026-03-04T20:00:00.000Z" }),
      makeEntry("2026-03-05", 5, { timestamp: "2026-03-05T21:00:00.000Z" }),
      makeEntry("2026-03-06", 6, { timestamp: "" }), // legacy: no recorded hour
      makeEntry("2026-03-07", 7), // missing timestamp entirely
      makeEntry("2026-03-08", 8, { timestamp: "not-a-date" }), // unparseable
    ];
    const tod = computeJournalPatterns(entries, "2026-04-15").timeOfDay;
    expect(tod).not.toBeNull();
    // Five real timestamps; the three without a usable hour never participate.
    expect(tod!.timestamped).toBe(5);
    // The distribution matches phaseOfHour over exactly the five timed entries.
    const want: [number, number, number, number] = [0, 0, 0, 0];
    for (const ts of [
      "2026-03-01T07:00:00.000Z",
      "2026-03-02T13:00:00.000Z",
      "2026-03-03T19:00:00.000Z",
      "2026-03-04T20:00:00.000Z",
      "2026-03-05T21:00:00.000Z",
    ]) {
      want[expectedPhase(ts)]++;
    }
    expect(tod!.counts).toEqual(want);
  });
});

describe("computeJournalPatterns — invariants over random journals (fuzz)", () => {
  // Deterministic LCG so any failure is reproducible from the printed seed.
  function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0x100000000;
    };
  }
  const METHODS = ["coin", "coin-manual", "yarrow", "yarrow-manual", undefined] as const;
  const KNOWN_METHODS = new Set(["coin", "coin-manual", "yarrow", "yarrow-manual"]);

  function randomJournal(rng: () => number): HistoryEntry[] {
    const n = Math.floor(rng() * 40); // 0–39 entries
    const entries: HistoryEntry[] = [];
    for (let i = 0; i < n; i++) {
      const primary = 1 + Math.floor(rng() * 64);
      let changing = [1, 2, 3, 4, 5, 6].filter(() => rng() < 0.25);
      // 1-in-6 entries carry deliberately malformed positions (out-of-range,
      // duplicate, >6) — the compute must normalize them and keep the two
      // moving-line distributions in agreement (the desync the review found).
      if (rng() < 0.16) {
        changing = [...changing, [0, 7, 99, -1][Math.floor(rng() * 4)], changing[0] ?? 3];
      }
      const method = METHODS[Math.floor(rng() * METHODS.length)];
      // Random day in a ~200-day window, random intra-day time — order shuffled.
      const day = 1 + Math.floor(rng() * 200);
      const date = new Date(Date.UTC(2026, 0, day)).toISOString().slice(0, 10);
      const hh = String(Math.floor(rng() * 24)).padStart(2, "0");
      entries.push({
        date,
        timestamp: `${date}T${hh}:00:00.000Z`,
        method,
        cast: makeCast(primary, rng() < 0.5 ? 1 + Math.floor(rng() * 64) : null, changing),
      });
    }
    return entries;
  }

  test("invariants hold across many random journals", () => {
    for (let seed = 1; seed <= 400; seed++) {
      const rng = lcg(seed);
      const entries = randomJournal(rng);
      let p;
      try {
        p = computeJournalPatterns(entries, "2026-08-01");
      } catch (err) {
        throw new Error(`computeJournalPatterns threw on seed ${seed}: ${String(err)}`);
      }
      const ctx = `seed ${seed}`;
      // Totals and the dense field.
      expect(p.total, ctx).toBe(entries.length);
      const fieldSum = p.field.counts.reduce((a, b) => a + b, 0);
      expect(fieldSum, ctx).toBe(entries.length); // every primary is in 1–64
      expect(p.field.counts, ctx).toHaveLength(64);
      expect(p.field.maxCount, ctx).toBe(Math.max(0, ...p.field.counts));
      // Method partition.
      const m = p.baseline.methods;
      expect(m.coin + m.yarrow + m.unknown, ctx).toBe(p.total);
      expect(m.known, ctx).toBe(m.coin + m.yarrow);
      const knownInput = entries.filter((e) => KNOWN_METHODS.has(e.method as string)).length;
      expect(m.known, ctx).toBe(knownInput);
      // 兩儀: every well-formed cast contributes exactly 6 lines.
      expect(p.lineBalance.yang + p.lineBalance.yin, ctx).toBe(entries.length * 6);
      // topHexagrams: capped, count-descending, count >= knownCount >= 0.
      expect(p.topHexagrams.length, ctx).toBeLessThanOrEqual(5);
      for (let i = 1; i < p.topHexagrams.length; i++) {
        expect(p.topHexagrams[i - 1].count >= p.topHexagrams[i].count, ctx).toBe(true);
      }
      for (const h of p.topHexagrams) {
        expect(h.count >= h.knownCount && h.knownCount >= 0, ctx).toBe(true);
        expect(h.kw >= 1 && h.kw <= 64, ctx).toBe(true);
      }
      // Moving lines: six positions, each observed count >= method-marked count.
      expect(p.movingLines, ctx).toHaveLength(6);
      for (const line of p.movingLines) {
        expect(line.count >= line.knownCount && line.knownCount >= 0, ctx).toBe(true);
      }
      // The two moving-line distributions describe the SAME population, even when
      // a journal carries malformed positions (per-position tally === bin-weighted
      // sum, for all readings and for the method-marked subset).
      const perPosition = p.movingLines.reduce((a, l) => a + l.count, 0);
      const viaBins = p.movingLineCounts.reduce((a, b) => a + b.movingLines * b.count, 0);
      expect(perPosition, ctx).toBe(viaBins);
      const perPositionKnown = p.movingLines.reduce((a, l) => a + l.knownCount, 0);
      const viaBinsKnown = p.movingLineCounts.reduce((a, b) => a + b.movingLines * b.knownCount, 0);
      expect(perPositionKnown, ctx).toBe(viaBinsKnown);
      expect(p.movingLineCounts.reduce((a, b) => a + b.count, 0), ctx).toBe(entries.length);
      // field.recent = primary of the chronologically latest entry, or null.
      if (entries.length === 0) {
        expect(p.field.recent, ctx).toBeNull();
        expect(p.cadence, ctx).toBeNull();
      } else {
        const latest = [...entries].sort((a, b) =>
          (a.timestamp ?? a.date).localeCompare(b.timestamp ?? b.date),
        )[entries.length - 1];
        expect(p.field.recent, ctx).toBe(latest.cast.primary);
      }
      // Old-line comparisons stay same-basis: observed never exceeds what the
      // method-marked casts could have produced (6 old-line slots each).
      expect(p.baseline.oldYin.observed + p.baseline.oldYang.observed, ctx).toBeLessThanOrEqual(
        m.known * 6,
      );
    }
  });
});
