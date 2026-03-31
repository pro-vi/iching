import { describe, test, expect } from "bun:test";
import { ScrollableRegion } from "../widgets/scrollable.ts";

describe("ScrollableRegion", () => {
  function makeRegion(lineCount: number, viewportHeight: number) {
    const lines = Array.from({ length: lineCount }, (_, i) => `Line ${i + 1}`);
    return new ScrollableRegion(viewportHeight, lines);
  }

  test("visibleLines returns first page by default", () => {
    const r = makeRegion(20, 5);
    expect(r.visibleLines()).toEqual([
      "Line 1", "Line 2", "Line 3", "Line 4", "Line 5",
    ]);
  });

  test("scrollDown moves viewport", () => {
    const r = makeRegion(20, 5);
    r.scrollDown(3);
    expect(r.scrollOffset).toBe(3);
    expect(r.visibleLines()[0]).toBe("Line 4");
  });

  test("scrollUp clamps to 0", () => {
    const r = makeRegion(20, 5);
    r.scrollUp(10);
    expect(r.scrollOffset).toBe(0);
  });

  test("scrollDown clamps to max offset", () => {
    const r = makeRegion(20, 5);
    r.scrollDown(100);
    expect(r.scrollOffset).toBe(15); // 20 - 5
  });

  test("pageDown scrolls by viewport height", () => {
    const r = makeRegion(20, 5);
    r.pageDown();
    expect(r.scrollOffset).toBe(5);
  });

  test("pageUp scrolls by viewport height", () => {
    const r = makeRegion(20, 5);
    r.scrollDown(10);
    r.pageUp();
    expect(r.scrollOffset).toBe(5);
  });

  test("scrollToTop resets offset", () => {
    const r = makeRegion(20, 5);
    r.scrollDown(10);
    r.scrollToTop();
    expect(r.scrollOffset).toBe(0);
  });

  test("scrollToBottom goes to last page", () => {
    const r = makeRegion(20, 5);
    r.scrollToBottom();
    expect(r.scrollOffset).toBe(15);
  });

  test("scrollIndicator shows page position", () => {
    const r = makeRegion(20, 5);
    expect(r.scrollIndicator()).toBe("1/4");
    r.pageDown();
    expect(r.scrollIndicator()).toBe("2/4");
    r.scrollToBottom();
    expect(r.scrollIndicator()).toBe("4/4");
  });

  test("scrollIndicator shows 1/1 when content fits viewport", () => {
    const r = makeRegion(3, 5);
    expect(r.scrollIndicator()).toBe("1/1");
  });

  test("visibleLines returns all when content fits viewport", () => {
    const r = makeRegion(3, 5);
    expect(r.visibleLines()).toHaveLength(3);
  });

  test("empty content works", () => {
    const r = new ScrollableRegion(5);
    expect(r.visibleLines()).toEqual([]);
    expect(r.scrollIndicator()).toBe("1/1");
    r.scrollDown();
    expect(r.scrollOffset).toBe(0);
  });
});
