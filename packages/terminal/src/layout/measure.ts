// Width measurement — uses Bun.stringWidth if available, fallback to simple length

/**
 * Measure the display width of a string.
 * Uses Bun.stringWidth for accurate CJK/emoji width when available.
 */
export function stringWidth(str: string): number {
  // Bun provides a native stringWidth that handles CJK, emoji, etc.
  if (typeof Bun !== "undefined" && typeof Bun.stringWidth === "function") {
    return Bun.stringWidth(str);
  }

  // Fallback: count characters, estimating CJK as width 2
  let width = 0;
  for (const ch of str) {
    const code = ch.codePointAt(0) ?? 0;
    if (isWideChar(code)) {
      width += 2;
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
