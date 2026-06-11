import { describe, test, expect } from "bun:test";
import { fgColor, bgColor } from "../ansi/sgr.ts";

/** Extract the palette index from a 256-color SGR sequence. */
function fg256(hex: string): number {
  const seq = fgColor(hex, "256");
  const m = seq.match(/^\x1b\[38;5;(\d+)m$/);
  if (!m) throw new Error(`not a 256-color fg sequence: ${JSON.stringify(seq)}`);
  return Number(m[1]);
}

describe("rgbTo256 quantization (via fgColor/bgColor)", () => {
  test("pure black maps to cube black (16)", () => {
    expect(fg256("#000000")).toBe(16);
  });

  test("pure white maps to cube white (231)", () => {
    expect(fg256("#FFFFFF")).toBe(231);
  });

  test("pure red maps to cube red (196)", () => {
    expect(fg256("#FF0000")).toBe(196);
  });

  test("dark warm tone stays dark on the gray ramp (bone dimmed)", () => {
    // #2C2418: old linear rounding sent channels 36-68 to cube level 95,
    // rendering this ~2x brighter as olive (95,95,0). Nearest match is
    // the dark gray-ramp entry 235 (38,38,38).
    expect(fg256("#2C2418")).toBe(235);
  });

  test("mid-dark near-gray prefers the ramp over a saturated cube color", () => {
    // #33312F averaged 49: cube candidates are 0 or 95 per channel —
    // the gray ramp entry 236 (48,48,48) is far closer.
    expect(fg256("#33312F")).toBe(236);
  });

  test("near-black theme background maps to the darkest ramp entry", () => {
    // ink bg #0A0A0F is not exact gray; it should still land near black
    expect(fg256("#0A0A0F")).toBe(232);
  });

  test("exact mid gray stays achromatic", () => {
    // #606060 → cube gray (95,95,95) = index 59, which is nearest
    expect(fg256("#606060")).toBe(59);
  });

  test("bgColor uses the same quantization", () => {
    expect(bgColor("#2C2418", "256")).toBe("\x1b[48;5;235m");
  });

  test("truecolor passes channels through unquantized", () => {
    expect(fgColor("#2C2418", "truecolor")).toBe("\x1b[38;2;44;36;24m");
  });

  test("none support emits nothing", () => {
    expect(fgColor("#2C2418", "none")).toBe("");
  });
});
