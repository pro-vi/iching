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
    if (isZeroWidthChar(code)) {
      continue;
    }
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
 * Check if a code point occupies no columns: variation selectors (U+FE0F
 * emoji presentation), zero-width joiner, and combining diacritics. Keeps
 * the Node fallback aligned with how terminals actually advance the cursor.
 */
function isZeroWidthChar(code: number): boolean {
  return (
    // Variation Selectors (incl. VS16 emoji presentation)
    (code >= 0xfe00 && code <= 0xfe0f) ||
    // Zero-width space / non-joiner / joiner / marks
    (code >= 0x200b && code <= 0x200d) ||
    // Combining Diacritical Marks
    (code >= 0x0300 && code <= 0x036f)
  );
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
    (code >= 0x30a0 && code <= 0x30ff) ||
    // CJK Radicals Supplement / Kangxi Radicals
    (code >= 0x2e80 && code <= 0x2fdf) ||
    // Emoji & pictograph blocks (East Asian Width = Wide). Hardcoded so the
    // Node fallback (npx path) measures identically to Bun.stringWidth.
    (code >= 0x1f300 && code <= 0x1f64f) ||
    (code >= 0x1f680 && code <= 0x1f6ff) ||
    (code >= 0x1f900 && code <= 0x1f9ff) ||
    (code >= 0x1fa70 && code <= 0x1faff) ||
    code === 0x1f004 || // mahjong tile red dragon
    code === 0x1f0cf || // playing card black joker
    // Wide emoji scattered through Misc Symbols / Dingbats (EAW=W list)
    (code >= 0x231a && code <= 0x231b) ||
    (code >= 0x23e9 && code <= 0x23ec) ||
    code === 0x23f0 ||
    code === 0x23f3 ||
    (code >= 0x25fd && code <= 0x25fe) ||
    (code >= 0x2614 && code <= 0x2615) ||
    (code >= 0x2648 && code <= 0x2653) ||
    code === 0x267f ||
    code === 0x2693 ||
    code === 0x26a1 ||
    (code >= 0x26aa && code <= 0x26ab) ||
    (code >= 0x26bd && code <= 0x26be) ||
    (code >= 0x26c4 && code <= 0x26c5) ||
    code === 0x26ce ||
    code === 0x26d4 ||
    code === 0x26ea ||
    (code >= 0x26f2 && code <= 0x26f3) ||
    code === 0x26f5 ||
    code === 0x26fa ||
    code === 0x26fd ||
    code === 0x2705 ||
    (code >= 0x270a && code <= 0x270b) ||
    code === 0x2728 ||
    code === 0x274c ||
    code === 0x274e ||
    (code >= 0x2753 && code <= 0x2755) ||
    code === 0x2757 ||
    (code >= 0x2795 && code <= 0x2797) ||
    code === 0x27b0 ||
    code === 0x27bf ||
    (code >= 0x2b1b && code <= 0x2b1c) ||
    code === 0x2b50 ||
    code === 0x2b55
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
