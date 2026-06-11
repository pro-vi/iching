import { describe, test, expect } from "bun:test";
import type { GlyphEntry } from "@iching/core";
import { CellBuffer } from "../render/buffer.ts";
import { getTheme } from "../color/theme.ts";
import type { GlyphAnimator } from "../glyph-anim/types.ts";
import { createGlyphAnimator, GLYPH_ANIM_DURATION_MS } from "../glyph-anim/factory.ts";
import { NoiseAnimator, NOISE_TOTAL_MS } from "../glyph-anim/noise.ts";
import { DotsAnimator, DOTS_TOTAL_MS } from "../glyph-anim/dots.ts";
import { RadialAnimator, RADIAL_TOTAL_MS } from "../glyph-anim/radial.ts";
import { SandAnimator, SAND_TOTAL_MS } from "../glyph-anim/sand.ts";

const FULL = "⣿"; // braille all-dots

function makeGlyph(): GlyphEntry {
  return {
    rows: [FULL.repeat(3), FULL.repeat(3)],
    width: 3,
    height: 2,
  };
}

describe("glyph animator durations", () => {
  test("duration map matches each animator's total run time", () => {
    expect(GLYPH_ANIM_DURATION_MS.noise).toBe(NOISE_TOTAL_MS);
    expect(GLYPH_ANIM_DURATION_MS.dots).toBe(DOTS_TOTAL_MS);
    expect(GLYPH_ANIM_DURATION_MS.radial).toBe(RADIAL_TOTAL_MS);
    expect(GLYPH_ANIM_DURATION_MS.sand).toBe(SAND_TOTAL_MS);
  });

  test("animators complete at their base duration with default scale", () => {
    const cases: [GlyphAnimator, number][] = [
      [new NoiseAnimator(makeGlyph()), NOISE_TOTAL_MS],
      [new DotsAnimator(makeGlyph()), DOTS_TOTAL_MS],
      [new RadialAnimator(makeGlyph()), RADIAL_TOTAL_MS],
      [new SandAnimator(makeGlyph()), SAND_TOTAL_MS],
    ];
    for (const [anim, total] of cases) {
      expect(anim.update(0)).toBe(false);
      expect(anim.update(total - 1)).toBe(false);
      expect(anim.update(total)).toBe(true);
    }
  });

  test("durationScale below 1 completes the animation faster", () => {
    const anim = new NoiseAnimator(makeGlyph(), 0.5);
    anim.update(0);
    expect(anim.update(NOISE_TOTAL_MS / 2 - 1)).toBe(false);
    expect(anim.update(NOISE_TOTAL_MS / 2)).toBe(true);
  });

  test("durationScale above 1 stretches the animation", () => {
    const anim = new RadialAnimator(makeGlyph(), 1.25);
    anim.update(0);
    expect(anim.update(RADIAL_TOTAL_MS)).toBe(false);
    expect(anim.update(RADIAL_TOTAL_MS * 1.25)).toBe(true);
  });

  test("factory passes durationScale through to the animator", () => {
    const anim = createGlyphAnimator("sand", makeGlyph(), 0.5);
    anim.update(0);
    expect(anim.update(SAND_TOTAL_MS * 0.5)).toBe(true);
  });

  test("scaled animator still settles to the real glyph in theme primary", () => {
    const anim = new NoiseAnimator(makeGlyph(), 0.5);
    anim.update(0);
    anim.update(NOISE_TOTAL_MS); // well past the scaled total
    const buf = new CellBuffer(10, 5);
    anim.render(buf, 0, 0);
    expect(buf.getCell(0, 0).char).toBe(FULL);
    expect(buf.getCell(0, 0).fg).toBe(getTheme().primary);
  });
});
