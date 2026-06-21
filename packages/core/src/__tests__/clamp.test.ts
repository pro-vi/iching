// clamp — constrain a value to [lo, hi]. The ~16 inline Math.max/min clamps
// across the core patterns and terminal renderers route through this; the bound
// behavior at and past each edge is the whole contract.

import { describe, test, expect } from "bun:test";
import { clamp } from "@iching/core";

describe("clamp", () => {
  test("passes a value already inside the range through", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(0, 0, 10)).toBe(0); // at the low edge
    expect(clamp(10, 0, 10)).toBe(10); // at the high edge
  });

  test("pins to the nearer bound when out of range", () => {
    expect(clamp(-3, 0, 10)).toBe(0); // below lo → lo
    expect(clamp(99, 0, 10)).toBe(10); // above hi → hi
  });

  test("a degenerate range [n, n] collapses to n", () => {
    expect(clamp(5, 3, 3)).toBe(3);
    expect(clamp(0, 4, 4)).toBe(4);
  });
});
