// readingFocus — which canonical text governs a reading (common classical rules)

import { describe, test, expect } from "bun:test";
import { readingFocus } from "../format/reading.js";

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

  test("three moving lines → noted, upper governs", () => {
    expect(readingFocus({ primary: 21, changingPositions: [2, 5, 3] })).toEqual({
      kind: "lines",
      positions: [2, 3, 5],
      governing: 5,
    });
  });

  test("four and five moving lines → the becoming", () => {
    expect(readingFocus({ primary: 21, changingPositions: [1, 2, 3, 4] })).toEqual({
      kind: "becoming",
    });
    expect(readingFocus({ primary: 21, changingPositions: [1, 2, 3, 4, 5] })).toEqual({
      kind: "becoming",
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
