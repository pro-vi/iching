import { describe, test, expect } from "bun:test";
import { wordWrap } from "../scenes/dict/word-wrap.ts";

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

  test("long word exceeding width stays on its own line", () => {
    const lines = wordWrap("superlongword short", 10);
    expect(lines[0]).toBe("superlongword");
    expect(lines[1]).toBe("short");
  });

  test("wraps CJK text", () => {
    const lines = wordWrap("天行健 君子以自強不息", 20);
    expect(lines.length).toBeGreaterThanOrEqual(1);
  });
});
