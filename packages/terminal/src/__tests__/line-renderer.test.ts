import { describe, test, expect } from "bun:test";
import { lineFrame } from "../scenes/cast/line-renderer.ts";
import { GLYPHS } from "../glyphs.ts";

describe("line-renderer", () => {
  test("yang line at progress 0 returns first frame", () => {
    const frame = lineFrame(true, 0);
    expect(frame).toBe(GLYPHS.yangFrames[0]);
  });

  test("yang line at progress 0.5 shows partial expansion", () => {
    const frame = lineFrame(true, 0.5);
    // At 0.5 with 7 frames: floor(0.5 * 7) = 3, so frame index 3
    expect(frame).toBe(GLYPHS.yangFrames[3]);
  });

  test("yang line at progress 1.0 shows full line", () => {
    const frame = lineFrame(true, 1.0);
    expect(frame).toBe(GLYPHS.yangFrames[GLYPHS.yangFrames.length - 1]);
    expect(frame).toBe(GLYPHS.yangFinal);
  });

  test("yin line at progress 0 returns first frame with gap", () => {
    const frame = lineFrame(false, 0);
    expect(frame).toBe(GLYPHS.yinFrames[0]);
    // Gap should be present
    expect(frame).toContain("   ");
  });

  test("yin line at progress 0.5 shows partial expansion with gap", () => {
    const frame = lineFrame(false, 0.5);
    expect(frame).toContain("   "); // gap preserved
  });

  test("yin line at progress 1.0 shows full line with gap", () => {
    const frame = lineFrame(false, 1.0);
    expect(frame).toBe(GLYPHS.yinFrames[GLYPHS.yinFrames.length - 1]);
    expect(frame).toBe(GLYPHS.yinFinal);
    expect(frame).toContain("   "); // gap preserved
  });

  test("yin line preserves gap at all progress values", () => {
    for (let p = 0; p <= 1; p += 0.1) {
      const frame = lineFrame(false, p);
      expect(frame).toContain("   "); // 3-space gap always present
    }
  });

  test("yang line grows wider as progress increases", () => {
    const frame0 = lineFrame(true, 0);
    const frame1 = lineFrame(true, 1);
    // Full frame should have more non-space characters
    const countBars = (s: string) => [...s].filter((c) => c !== " ").length;
    expect(countBars(frame1)).toBeGreaterThan(countBars(frame0));
  });

  test("progress clamped to [0, 1]", () => {
    const frameNeg = lineFrame(true, -0.5);
    const frame0 = lineFrame(true, 0);
    expect(frameNeg).toBe(frame0);

    const frameOver = lineFrame(true, 1.5);
    const frame1 = lineFrame(true, 1.0);
    expect(frameOver).toBe(frame1);
  });
});
