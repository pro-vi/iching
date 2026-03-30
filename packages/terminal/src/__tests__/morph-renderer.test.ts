import { describe, test, expect } from "bun:test";
import { morphFrame } from "../scenes/cast/morph-renderer.ts";
import { GLYPHS } from "../glyphs.ts";

describe("morph-renderer", () => {
  test("yang->yin morph at progress 0 shows solid (first frame)", () => {
    const frame = morphFrame(true, 0);
    expect(frame).toBe(GLYPHS.changingYangToYin[0]);
    // First frame is full solid line
    expect(frame).toBe(GLYPHS.yangFinal);
  });

  test("yang->yin morph at progress 0.5 shows intermediate", () => {
    const frame = morphFrame(true, 0.5);
    // With 3 frames: floor(0.5 * 3) = 1, so frame index 1 (small gap)
    expect(frame).toBe(GLYPHS.changingYangToYin[1]);
    // Should have a single-space gap
    expect(frame).toContain(" ");
  });

  test("yang->yin morph at progress 1.0 shows broken (yin)", () => {
    const frame = morphFrame(true, 1.0);
    expect(frame).toBe(GLYPHS.changingYangToYin[GLYPHS.changingYangToYin.length - 1]);
    // Final frame should be the yin form with gap
    expect(frame).toContain("   ");
  });

  test("yin->yang morph at progress 0 shows broken (first frame)", () => {
    const frame = morphFrame(false, 0);
    expect(frame).toBe(GLYPHS.changingYinToYang[0]);
    // First frame is yin (broken)
    expect(frame).toContain("   ");
  });

  test("yin->yang morph at progress 0.5 shows intermediate", () => {
    const frame = morphFrame(false, 0.5);
    expect(frame).toBe(GLYPHS.changingYinToYang[1]);
  });

  test("yin->yang morph at progress 1.0 shows solid (yang)", () => {
    const frame = morphFrame(false, 1.0);
    expect(frame).toBe(GLYPHS.changingYinToYang[GLYPHS.changingYinToYang.length - 1]);
    // Final frame should be solid yang
    expect(frame).toBe(GLYPHS.yangFinal);
  });

  test("progress clamped to [0, 1]", () => {
    const frameNeg = morphFrame(true, -0.5);
    const frame0 = morphFrame(true, 0);
    expect(frameNeg).toBe(frame0);

    const frameOver = morphFrame(true, 1.5);
    const frame1 = morphFrame(true, 1.0);
    expect(frameOver).toBe(frame1);
  });

  test("yang->yin has 3 frames", () => {
    expect(GLYPHS.changingYangToYin).toHaveLength(3);
  });

  test("yin->yang has 3 frames", () => {
    expect(GLYPHS.changingYinToYang).toHaveLength(3);
  });
});
