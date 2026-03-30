import { describe, test, expect } from "bun:test";
import { stringWidth, centerPad } from "../layout/measure.ts";

describe("stringWidth", () => {
  test("ASCII string has length = width", () => {
    expect(stringWidth("hello")).toBe(5);
    expect(stringWidth("")).toBe(0);
    expect(stringWidth("a")).toBe(1);
  });

  test("CJK character has width 2", () => {
    // 世 = U+4E16 (CJK Unified Ideograph)
    expect(stringWidth("\u4e16")).toBe(2);
    // 界 = U+754C
    expect(stringWidth("\u754c")).toBe(2);
    // Two CJK chars = width 4
    expect(stringWidth("\u4e16\u754c")).toBe(4);
  });

  test("mixed ASCII and CJK", () => {
    // "hi世界" = 2 + 4 = 6
    expect(stringWidth("hi\u4e16\u754c")).toBe(6);
  });
});

describe("centerPad", () => {
  test("centers text within total width", () => {
    const result = centerPad("hi", 10);
    expect(result.length).toBe(10);
    // "hi" is width 2, so 4 left pad, 4 right pad
    expect(result).toBe("    hi    ");
  });

  test("returns string as-is when wider than total width", () => {
    const result = centerPad("hello world", 5);
    expect(result).toBe("hello world");
  });

  test("handles empty string", () => {
    const result = centerPad("", 10);
    expect(result).toBe("          ");
  });

  test("pads correctly for odd widths", () => {
    const result = centerPad("x", 6);
    // width 1, total 6: left=2, right=3
    expect(result.length).toBe(6);
    expect(result).toBe("  x   ");
  });

  test("pads correctly for various terminal widths", () => {
    const text = "I Ching";
    for (const width of [80, 100, 120]) {
      const result = centerPad(text, width);
      expect(stringWidth(result)).toBe(width);
    }
  });
});
