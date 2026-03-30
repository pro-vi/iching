import { describe, test, expect } from "bun:test";
import {
  canSplit,
  hexColOffset,
  MIN_SPLIT_WIDTH,
  SPLIT_OFFSET,
} from "../scenes/cast/layout-calc.ts";

describe("layout-calc", () => {
  describe("canSplit", () => {
    test("returns false below MIN_SPLIT_WIDTH", () => {
      expect(canSplit(49)).toBe(false);
      expect(canSplit(40)).toBe(false);
      expect(canSplit(20)).toBe(false);
    });

    test("returns true at MIN_SPLIT_WIDTH", () => {
      expect(canSplit(MIN_SPLIT_WIDTH)).toBe(true);
    });

    test("returns true above MIN_SPLIT_WIDTH", () => {
      expect(canSplit(80)).toBe(true);
      expect(canSplit(120)).toBe(true);
    });
  });

  describe("hexColOffset", () => {
    test("center always returns 0 regardless of progress", () => {
      expect(hexColOffset("center", 0)).toBe(0);
      expect(hexColOffset("center", 0.5)).toBe(0);
      expect(hexColOffset("center", 1)).toBe(0);
    });

    test("left at progress 0 returns 0 (centered)", () => {
      expect(hexColOffset("left", 0) === 0 || hexColOffset("left", 0) === -0).toBe(true);
      expect(Math.abs(hexColOffset("left", 0))).toBe(0);
    });

    test("right at progress 0 returns 0 (centered)", () => {
      expect(hexColOffset("right", 0)).toBe(0);
    });

    test("left at progress 1 returns negative SPLIT_OFFSET", () => {
      expect(hexColOffset("left", 1)).toBe(-SPLIT_OFFSET);
    });

    test("right at progress 1 returns positive SPLIT_OFFSET", () => {
      expect(hexColOffset("right", 1)).toBe(SPLIT_OFFSET);
    });

    test("left and right are symmetric", () => {
      const leftOff = hexColOffset("left", 0.5);
      const rightOff = hexColOffset("right", 0.5);
      expect(leftOff).toBe(-rightOff);
    });

    test("intermediate progress returns rounded offset", () => {
      const offset = hexColOffset("right", 0.5);
      expect(offset).toBe(Math.round(SPLIT_OFFSET * 0.5));
    });
  });
});
