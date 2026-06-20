// lerpColor — linear interpolation between two "#RRGGBB" hex colors.
//
// Shared by the glyph animators and ritual renderers so eased tweens read as
// continuous fades instead of hard bucket switches. The output is a plain hex
// color: under truecolor it renders exactly; under 16/256 support it falls
// through the existing quantization in ansi/sgr.ts at write time.

import { clamp } from "@iching/core";
import { hexToRgb, rgbToHex } from "./hex.ts";

/** Interpolate between hex colors a and b. t is clamped to [0, 1]. */
export function lerpColor(a: string, b: string, t: number): string {
  const tt = clamp(t, 0, 1);
  const toByte = (v: number) => clamp(Math.round(v), 0, 255);
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = toByte(ar + (br - ar) * tt);
  const g = toByte(ag + (bg - ag) * tt);
  const bv = toByte(ab + (bb - ab) * tt);
  return rgbToHex(r, g, bv);
}
