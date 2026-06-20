// Braille-cell primitives shared by the glyph animators. A braille glyph packs a
// 2×4 dot grid into one codepoint at BRAILLE_BASE + a 0–255 dot mask, so the block
// spans BRAILLE_COUNT (256) codepoints; the blank cell (U+2800) reads as empty.

export const BRAILLE_BASE = 0x2800;
export const BRAILLE_COUNT = 256;

/** An unlit cell: the blank braille pattern (U+2800) or a plain space. */
export function isEmpty(ch: string): boolean {
  return ch === "\u2800" || ch === " ";
}
