// readingFocus — which canonical text governs a reading (common classical rules)

import { describe, test, expect } from "bun:test";
import type { Cast } from "../types.js";
import { readingFocus, readingTexts } from "../format/reading.js";

describe("readingFocus", () => {
  test("no moving lines → the judgment", () => {
    expect(readingFocus({ primary: 21, changingPositions: [] })).toEqual({
      kind: "judgment",
    });
  });

  test("one moving line → that line", () => {
    expect(readingFocus({ primary: 21, changingPositions: [4] })).toEqual({
      kind: "line",
      position: 4,
    });
  });

  test("two moving lines → both noted, upper governs", () => {
    expect(readingFocus({ primary: 21, changingPositions: [4, 1] })).toEqual({
      kind: "lines",
      positions: [1, 4],
      governing: 4,
    });
  });

  test("three moving lines → both judgments (本卦 and 之卦)", () => {
    expect(readingFocus({ primary: 21, changingPositions: [2, 5, 3] })).toEqual({
      kind: "dualJudgment",
    });
  });

  test("four moving lines → the becoming's two unchanged lines, lower primary", () => {
    expect(readingFocus({ primary: 21, changingPositions: [1, 2, 3, 4] })).toEqual({
      kind: "stillLines",
      positions: [5, 6],
      governing: 5,
    });
  });

  test("five moving lines → the becoming's one unchanged line", () => {
    expect(readingFocus({ primary: 21, changingPositions: [1, 2, 3, 4, 5] })).toEqual({
      kind: "stillLines",
      positions: [6],
      governing: 6,
    });
  });

  test("all six on hexagram 1 → 用九", () => {
    expect(
      readingFocus({ primary: 1, changingPositions: [1, 2, 3, 4, 5, 6] }),
    ).toEqual({ kind: "extra", name: "用九" });
  });

  test("all six on hexagram 2 → 用六", () => {
    expect(
      readingFocus({ primary: 2, changingPositions: [1, 2, 3, 4, 5, 6] }),
    ).toEqual({ kind: "extra", name: "用六" });
  });

  test("all six on any other hexagram → the becoming", () => {
    expect(
      readingFocus({ primary: 63, changingPositions: [1, 2, 3, 4, 5, 6] }),
    ).toEqual({ kind: "becoming" });
  });

  test("does not mutate the input positions", () => {
    const positions = [5, 2];
    readingFocus({ primary: 3, changingPositions: positions });
    expect(positions).toEqual([5, 2]);
  });
});

describe("readingTexts — the ordered canonical reading (governing first)", () => {
  const cast = (primary: number, becoming: number | null, changingPositions: number[]): Cast => ({
    lines: [],
    primary,
    becoming,
    changingPositions,
    nuclear: 1,
    polarity: 2,
    mirror: 1,
    diagonal: 2,
  });

  test("0 moving → the primary judgment", () => {
    expect(readingTexts(cast(21, null, []))).toEqual([{ kind: "judgment", kw: 21 }]);
  });

  test("1 moving → that line of the primary", () => {
    expect(readingTexts(cast(21, 42, [4]))).toEqual([{ kind: "line", kw: 21, position: 4 }]);
  });

  test("2 moving → both lines, the upper first", () => {
    expect(readingTexts(cast(21, 42, [1, 4]))).toEqual([
      { kind: "line", kw: 21, position: 4 },
      { kind: "line", kw: 21, position: 1 },
    ]);
  });

  test("3 moving → both judgments, primary then becoming", () => {
    expect(readingTexts(cast(21, 42, [1, 3, 5]))).toEqual([
      { kind: "judgment", kw: 21 },
      { kind: "judgment", kw: 42 },
    ]);
  });

  test("4 moving → the becoming's UNCHANGED lines, the LOWER first (啟蒙 以下爻為主)", () => {
    expect(readingTexts(cast(21, 18, [1, 2, 3, 4]))).toEqual([
      { kind: "line", kw: 18, position: 5 },
      { kind: "line", kw: 18, position: 6 },
    ]);
  });

  test("5 moving → the becoming's one unchanged line", () => {
    expect(readingTexts(cast(21, 18, [1, 2, 3, 4, 5]))).toEqual([
      { kind: "line", kw: 18, position: 6 },
    ]);
  });

  test("6 moving on hex 1/2 → 用九/用六; elsewhere → the becoming judgment", () => {
    expect(readingTexts(cast(1, 2, [1, 2, 3, 4, 5, 6]))).toEqual([{ kind: "extra", kw: 1 }]);
    expect(readingTexts(cast(63, 64, [1, 2, 3, 4, 5, 6]))).toEqual([{ kind: "judgment", kw: 64 }]);
  });
});
