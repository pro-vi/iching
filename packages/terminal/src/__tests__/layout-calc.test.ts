import { describe, test, expect } from "bun:test";
import {
  canSplit,
  hexColOffset,
  glyphRevealMode,
  glyphTitleLineCount,
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

  // The settled-reveal vertical budget: the reading texts win the fight;
  // the glyph keeps "normal" placement, compresses to "compact" (title
  // yields), or yields entirely ("none"). Anchor at h=24 is 15; at h=30, 18.
  describe("glyphRevealMode", () => {
    test("no glyph (height 0) is always none", () => {
      expect(glyphRevealMode(40, 23, 0, 1, 2)).toBe("none");
    });

    test("24 rows: an 8-row glyph cannot coexist with any panel — none", () => {
      // compact bound: G + P <= 24 - 15 - 2 = 7 < 8
      expect(glyphRevealMode(24, 15, 8, 1, 1)).toBe("none");
      expect(glyphRevealMode(24, 15, 8, 2, 4)).toBe("none");
    });

    test("30 rows: an 8-row glyph plus a 2-row panel fits compactly", () => {
      // compact bound: 8 + 2 <= 30 - 18 - 2 = 10
      expect(glyphRevealMode(30, 18, 8, 1, 2)).toBe("compact");
    });

    test("30 rows: a 3-row panel pushes the glyph out — none", () => {
      expect(glyphRevealMode(30, 18, 8, 1, 3)).toBe("none");
    });

    test("40 rows: glyph, title, and panel all fit — normal", () => {
      // normal bound: 8 + 1 + 3 <= 40 - 23 - 4 = 13
      expect(glyphRevealMode(40, 23, 8, 1, 3)).toBe("normal");
    });

    test("boundary: exactly the normal bound is still normal", () => {
      // G + T + P = bufHeight - anchor - 4
      expect(glyphRevealMode(36, 21, 8, 1, 2)).toBe("normal");
      expect(glyphRevealMode(36, 21, 8, 1, 3)).toBe("compact");
    });
  });

  describe("glyphTitleLineCount", () => {
    test("split shows the pinyin only", () => {
      expect(glyphTitleLineCount(true, true)).toBe(1);
      expect(glyphTitleLineCount(true, false)).toBe(1);
    });

    test("centered English shows pinyin/ename/translation/structure", () => {
      expect(glyphTitleLineCount(false, true)).toBe(4);
    });

    test("centered Chinese shows pinyin and structure", () => {
      expect(glyphTitleLineCount(false, false)).toBe(2);
    });
  });
});
