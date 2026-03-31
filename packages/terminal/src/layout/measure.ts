// Width measurement — uses Bun.stringWidth if available, fallback to simple length

/**
 * Measure the display width of a string.
 * Uses Bun.stringWidth for accurate CJK/emoji width when available,
 * with corrections for characters Bun misreports (I Ching hexagram symbols).
 */
export function stringWidth(str: string): number {
  let width = 0;
  for (const ch of str) {
    const code = ch.codePointAt(0) ?? 0;
    if (isWideChar(code)) {
      width += 2;
    } else if (typeof Bun !== "undefined" && typeof Bun.stringWidth === "function") {
      width += Bun.stringWidth(ch);
    } else {
      width += 1;
    }
  }
  return width;
}

/**
 * Check if a Unicode code point is a "wide" character (CJK, etc.)
 */
function isWideChar(code: number): boolean {
  return (
    // I Ching Hexagram Symbols (Bun.stringWidth misreports as 1, terminals render as 2)
    (code >= 0x4dc0 && code <= 0x4dff) ||
    // CJK Unified Ideographs
    (code >= 0x4e00 && code <= 0x9fff) ||
    // CJK Extension A
    (code >= 0x3400 && code <= 0x4dbf) ||
    // CJK Compatibility Ideographs
    (code >= 0xf900 && code <= 0xfaff) ||
    // Hangul Syllables
    (code >= 0xac00 && code <= 0xd7af) ||
    // CJK Unified Ideographs Extension B+
    (code >= 0x20000 && code <= 0x2a6df) ||
    // Fullwidth forms
    (code >= 0xff01 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    // Katakana / Hiragana
    (code >= 0x3000 && code <= 0x303f) ||
    (code >= 0x3040 && code <= 0x309f) ||
    (code >= 0x30a0 && code <= 0x30ff)
  );
}

/**
 * Center a string within a given total width.
 * Returns the string padded with spaces on both sides.
 */
export function centerPad(str: string, totalWidth: number): string {
  const w = stringWidth(str);
  if (w >= totalWidth) return str;
  const leftPad = Math.floor((totalWidth - w) / 2);
  const rightPad = totalWidth - w - leftPad;
  return " ".repeat(leftPad) + str + " ".repeat(rightPad);
}
