import { describe, test, expect } from "bun:test";
import { coinSpinGlyph, coinLandGlyph } from "../scenes/cast/coin-renderer.ts";
import { GLYPHS } from "../glyphs.ts";

describe("coin-renderer", () => {
  test("spin glyph at progress 0 returns first spin frame", () => {
    const glyph = coinSpinGlyph(0, 0);
    expect(GLYPHS.coinSpin).toContain(glyph);
  });

  test("spin glyph at progress 0.5 returns a spin frame", () => {
    const glyph = coinSpinGlyph(0.5, 0);
    expect(GLYPHS.coinSpin).toContain(glyph);
  });

  test("spin glyph at progress 1 returns a spin frame", () => {
    const glyph = coinSpinGlyph(1, 0);
    expect(GLYPHS.coinSpin).toContain(glyph);
  });

  test("spin glyphs cycle through frames as progress increases", () => {
    const glyphs = new Set<string>();
    for (let p = 0; p <= 1; p += 0.1) {
      glyphs.add(coinSpinGlyph(p, 0));
    }
    // Should see more than 1 unique glyph across the range
    expect(glyphs.size).toBeGreaterThan(1);
  });

  test("landed heads returns coinHeads glyph", () => {
    expect(coinLandGlyph(true)).toBe(GLYPHS.coinHeads);
  });

  test("landed tails returns coinTails glyph", () => {
    expect(coinLandGlyph(false)).toBe(GLYPHS.coinTails);
  });

  test("heads glyph is filled circle", () => {
    expect(coinLandGlyph(true)).toBe("\u25CF");
  });

  test("tails glyph is open circle", () => {
    expect(coinLandGlyph(false)).toBe("\u25CB");
  });
});
