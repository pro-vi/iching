import { describe, test, expect } from "bun:test";
import { wordWrap } from "../scenes/dict/word-wrap.ts";
import { stringWidth } from "../layout/measure.ts";

describe("wordWrap", () => {
  test("short text stays on one line", () => {
    expect(wordWrap("hello world", 40)).toEqual(["hello world"]);
  });

  test("wraps at word boundary", () => {
    const lines = wordWrap("one two three four", 10);
    expect(lines).toEqual(["one two", "three four"]);
  });

  test("preserves paragraphs", () => {
    const lines = wordWrap("first\n\nsecond", 40);
    expect(lines).toEqual(["first", "", "second"]);
  });

  test("handles empty string", () => {
    expect(wordWrap("", 40)).toEqual([""]);
  });

  test("handles zero width", () => {
    expect(wordWrap("hello", 0)).toEqual([]);
  });

  test("long word exceeding width is broken", () => {
    const lines = wordWrap("superlongword short", 10);
    expect(lines[0]).toBe("superlongw");
    expect(lines[1]).toBe("ord");
    expect(lines[2]).toBe("short");
  });

  test("CJK text without spaces wraps at character boundary", () => {
    // Each CJK char is width 2, so 5 chars = 10 width
    // With maxWidth=10, should fit 5 CJK chars per line
    const cjk = "天行健君子以自強不息";
    const lines = wordWrap(cjk, 10);
    expect(lines.length).toBe(2);
    expect(stringWidth(lines[0])).toBeLessThanOrEqual(10);
    expect(stringWidth(lines[1])).toBeLessThanOrEqual(10);
  });

  test("wraps CJK text", () => {
    const lines = wordWrap("天行健 君子以自強不息", 20);
    expect(lines.length).toBeGreaterThanOrEqual(1);
  });
});
