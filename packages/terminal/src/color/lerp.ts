// lerpColor — linear interpolation between two "#RRGGBB" hex colors.
//
// Shared by the glyph animators and ritual renderers so eased tweens read as
// continuous fades instead of hard bucket switches. The output is a plain hex
// color: under truecolor it renders exactly; under 16/256 support it falls
// through the existing quantization in ansi/sgr.ts at write time.

/** Interpolate between hex colors a and b. t is clamped to [0, 1]. */
export function lerpColor(a: string, b: string, t: number): string {
  const tt = Math.max(0, Math.min(1, t));
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
  const r = clamp(ar + (br - ar) * tt);
  const g = clamp(ag + (bg - ag) * tt);
  const bv = clamp(ab + (bb - ab) * tt);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bv.toString(16).padStart(2, "0")}`;
}
