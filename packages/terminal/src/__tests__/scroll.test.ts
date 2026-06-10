import { describe, test, expect } from "bun:test";
import { clampOffset, offsetToShow, windowFor, pageIndicator } from "../widgets/scroll.ts";

describe("clampOffset", () => {
  test("clamps into [0, contentLength - viewport]", () => {
    expect(clampOffset(-3, 10, 4)).toBe(0);
    expect(clampOffset(99, 10, 4)).toBe(6); // max = 10 - 4
    expect(clampOffset(2, 10, 4)).toBe(2);
  });
  test("content shorter than viewport → 0", () => {
    expect(clampOffset(5, 3, 10)).toBe(0);
  });
});

describe("offsetToShow (cursor-into-view, stateful)", () => {
  test("keeps a visible cursor's offset unchanged", () => {
    expect(offsetToShow(3, 2, 5)).toBe(2); // 3 in [2,7)
  });
  test("scrolls up when cursor is above the window", () => {
    expect(offsetToShow(1, 4, 5)).toBe(1);
  });
  test("scrolls down so the cursor sits at the bottom of the window", () => {
    expect(offsetToShow(9, 2, 5)).toBe(5); // 9 - 5 + 1
  });
});

describe("windowFor (stateless window)", () => {
  test("everything fits → full range", () => {
    expect(windowFor(0, 10, 7)).toEqual({ start: 0, end: 7 });
  });
  test("focused near the top stays at 0", () => {
    expect(windowFor(1, 5, 7)).toEqual({ start: 0, end: 5 });
  });
  test("focused at the end scrolls to keep it visible", () => {
    expect(windowFor(6, 5, 7)).toEqual({ start: 2, end: 7 });
  });
  test("clamps so the window never exceeds total", () => {
    const w = windowFor(6, 5, 7);
    expect(w.end - w.start).toBe(5);
    expect(w.end).toBeLessThanOrEqual(7);
  });
});

describe("pageIndicator", () => {
  test("'1/1' when content fits", () => {
    expect(pageIndicator(0, 5, 20)).toBe("1/1");
  });
  test("page math over multiple viewports", () => {
    expect(pageIndicator(0, 42, 20)).toBe("1/3");
    expect(pageIndicator(20, 42, 20)).toBe("2/3");
    expect(pageIndicator(40, 42, 20)).toBe("3/3");
  });
});
