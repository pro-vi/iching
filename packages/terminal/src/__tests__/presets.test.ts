import { describe, test, expect } from "bun:test";
import { getPreset, type RitualTiming } from "../animation/presets.ts";

describe("motion presets", () => {
  test("default preset has expected timing values", () => {
    const d = getPreset("default");
    expect(d.startBreathMs).toBe(800);
    expect(d.preTossMs).toBe(300);
    expect(d.coinFrameMs).toBe(80);
    expect(d.restMs).toBe(200);
  });

  test("brisk is faster than default", () => {
    const d = getPreset("default");
    const b = getPreset("brisk");

    // Every timing field in brisk should be <= default
    const keys = Object.keys(d) as (keyof RitualTiming)[];
    for (const key of keys) {
      expect(b[key]).toBeLessThanOrEqual(d[key]);
    }

    // At least some should be strictly less
    expect(b.startBreathMs).toBeLessThan(d.startBreathMs);
    expect(b.coinFrameMs).toBeLessThan(d.coinFrameMs);
    expect(b.preTossMs).toBeLessThan(d.preTossMs);
  });

  test("deep is slower than default", () => {
    const d = getPreset("default");
    const dp = getPreset("deep");

    // Every timing field in deep should be >= default
    const keys = Object.keys(d) as (keyof RitualTiming)[];
    for (const key of keys) {
      expect(dp[key]).toBeGreaterThanOrEqual(d[key]);
    }

    // At least some should be strictly greater
    expect(dp.startBreathMs).toBeGreaterThan(d.startBreathMs);
    expect(dp.coinFrameMs).toBeGreaterThan(d.coinFrameMs);
    expect(dp.preTossMs).toBeGreaterThan(d.preTossMs);
  });

  test("reduced has same structure as default", () => {
    const d = getPreset("default");
    const r = getPreset("reduced");

    const dKeys = Object.keys(d).sort();
    const rKeys = Object.keys(r).sort();
    expect(rKeys).toEqual(dKeys);
  });

  test("reduced preserves pauses but zeroes movement", () => {
    const r = getPreset("reduced");

    // Pauses preserved
    expect(r.startBreathMs).toBeGreaterThan(0);
    expect(r.landHoldMs).toBeGreaterThan(0);
    expect(r.restMs).toBeGreaterThan(0);

    // Movement zeroed
    expect(r.coinFrameMs).toBe(0);
    expect(r.coinStaggerMs).toBe(0);
    expect(r.coinStageMs).toBe(0);
    expect(r.lineFrameMs).toBe(0);
    expect(r.lineSettleMs).toBe(0);
    expect(r.finalGlowUpMs).toBe(0);
    expect(r.finalGlowDownMs).toBe(0);
  });

  test("glyph reveal: reduced skips the animation, other presets scale it", () => {
    expect(getPreset("default").glyphAnimScale).toBe(1);
    expect(getPreset("brisk").glyphAnimScale).toBeLessThan(1);
    expect(getPreset("brisk").glyphAnimScale).toBeGreaterThan(0);
    expect(getPreset("deep").glyphAnimScale).toBeGreaterThan(1);
    expect(getPreset("reduced").glyphAnimScale).toBe(0);
  });

  test("glyph breath is preserved across all presets (reduced keeps pauses)", () => {
    for (const name of ["default", "brisk", "deep", "reduced"] as const) {
      expect(getPreset(name).glyphBreathMs).toBeGreaterThan(0);
    }
  });

  test("getPreset returns a copy (not a reference)", () => {
    const a = getPreset("default");
    const b = getPreset("default");
    a.startBreathMs = 9999;
    expect(b.startBreathMs).toBe(800);
  });
});
