import { describe, test, expect } from "bun:test";
import { getYarrowTiming } from "../animation/yarrow-presets.ts";
import type { MotionPreset } from "../animation/presets.ts";

const ALL: MotionPreset[] = ["default", "deep", "brisk", "reduced"];

describe("getYarrowTiming", () => {
  test("every motion preset resolves to a populated timing and detail", () => {
    for (const motion of ALL) {
      const { timing, detail } = getYarrowTiming(motion);
      expect(["expanded", "summarized", "stepped"]).toContain(detail);
      for (const v of Object.values(timing)) {
        expect(typeof v).toBe("number");
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test("motion maps to the expected ritual detail", () => {
    expect(getYarrowTiming("deep").detail).toBe("expanded");
    expect(getYarrowTiming("default").detail).toBe("summarized");
    expect(getYarrowTiming("brisk").detail).toBe("stepped");
    expect(getYarrowTiming("reduced").detail).toBe("stepped");
  });

  test("reduced collapses motion durations but keeps structural holds", () => {
    const { timing } = getYarrowTiming("reduced");
    // Motion beats are instant.
    expect(timing.divideMs).toBe(0);
    expect(timing.countMs).toBe(0);
    expect(timing.fuseMs).toBe(0);
    // Structural holds survive so each round is still perceptible.
    expect(timing.tallyHoldMs).toBeGreaterThan(0);
    expect(timing.roundGapMs).toBeGreaterThan(0);
  });

  test("deep is slower than default is slower than brisk", () => {
    const sum = (m: MotionPreset) =>
      Object.values(getYarrowTiming(m).timing).reduce((a, b) => a + b, 0);
    expect(sum("deep")).toBeGreaterThan(sum("default"));
    expect(sum("default")).toBeGreaterThan(sum("brisk"));
    expect(sum("brisk")).toBeGreaterThan(sum("reduced"));
  });

  test("returns a fresh copy each call", () => {
    const a = getYarrowTiming("default").timing;
    const b = getYarrowTiming("default").timing;
    expect(a).not.toBe(b);
    a.countMs = 9999;
    expect(getYarrowTiming("default").timing.countMs).not.toBe(9999);
  });
});
