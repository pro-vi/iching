// reading-lines.ts — pure construction of the reading panel's text lines.
//
// Extracted from reading-renderer.ts so the reveal layout (which budgets
// vertical space between the glyph, the title block, and these texts) can
// measure the panel without an import cycle. The texts a reading is made of
// follow readingFocus (a simplified modern moving-line rule — see its doc for
// where it agrees with and departs from the classical 啟蒙 method): the changing
// lines' 爻辭 read top-down (line 6 at the top down to line 1, so the upper line
// leads), the becoming hexagram's 卦辭 when four or five move, or — when no lines
// move — the primary 卦辭, since the judgment IS the reading in that case. Quiet,
// observational, never interpretive.

import { type Cast, type DisplayLanguage, GUA, readingFocus, toSimplified } from "@iching/core";
import { wordWrap } from "../dict/word-wrap.ts";
import { tr } from "../../i18n/messages.ts";

export interface ReadingLine {
  text: string;
  role: "text" | "more";
  /**
   * True on the one wrapped line that leads with a dim type-label
   * ("卦辭 · ", "Judgment · ", "4 · "). The renderer dims everything up to the
   * separator so the canonical text itself carries the weight — the same
   * label/subject hierarchy as the 觀象 pane. Continuation lines and the bare
   * zh 爻辭 (which the hint already names) carry no label.
   */
  labeled?: boolean;
}

/**
 * Build the reading-panel lines, wrapped to `width` and truncated to
 * `maxRows` (a dim "…" row stands in for what didn't fit — the detail
 * view always holds the full texts).
 */
export function buildReadingLines(
  cast: Cast,
  language: DisplayLanguage,
  width: number,
  maxRows: number,
): ReadingLine[] {
  if (maxRows < 1 || width < 4) return [];

  const gua = GUA[cast.primary - 1];
  const english = language === "en";
  const cn = (s: string): string => (language === "zh-Hans" ? toSimplified(s) : s);
  const focus = readingFocus(cast);

  const lines: ReadingLine[] = [];

  // `labeled` marks the first wrapped line when the text leads with a dim
  // type-label ("卦辭 · ", "Judgment · ", "4 · "); only that line bears it.
  const pushText = (text: string, labeled = false): void => {
    const wrapped = wordWrap(text, width);
    wrapped.forEach((wl, i) => {
      lines.push(labeled && i === 0 ? { text: wl, role: "text", labeled: true } : { text: wl, role: "text" });
    });
  };

  const pushYao = (pos: number): void => {
    // en prefixes the line position ("4 · …") — a label to dim; the zh 爻辭 opens
    // with its own line name (初九/上六…), so it is self-labeling and stays bare.
    if (english) pushText(`${pos} · ${gua.yaoEn[pos - 1]}`, true);
    else pushText(cn(gua.yao[pos - 1]));
  };

  if (focus.kind === "judgment") {
    // No moving lines — the judgment is the reading.
    const label = tr(language, "cast.judgment");
    pushText(english ? `${label} · ${gua.gcEn}` : `${label} · ${cn(gua.gc)}`, true);
  } else if (focus.kind === "extra" && gua.extra) {
    // All six lines move on hex 1/2 — the 用九/用六 text governs.
    pushText(
      english
        ? `${gua.extra.name} · ${gua.extra.textEn}`
        : `${cn(gua.extra.name)} · ${cn(gua.extra.text)}`,
      true,
    );
  } else if (focus.kind === "becoming" && cast.becoming !== null) {
    // Four or five lines move (or all six off hex 1/2) — the becoming
    // hexagram's 卦辭 is the reading. The hint already names the becoming as
    // the speaker and the title block shows it, so the label names only the
    // text TYPE (Judgment / 卦辭) — repeating "Becoming" here was a stutter.
    const becoming = GUA[cast.becoming - 1];
    const label = tr(language, "cast.judgment");
    pushText(english ? `${label} · ${becoming.gcEn}` : `${label} · ${cn(becoming.gc)}`, true);
  } else {
    // The moving lines' 爻辭, read top-down — the same order the figure shows
    // them (line 6 at the top down to line 1), so the upper line leads. Covers
    // one moving line, the 2–3 "lines" case, and any fallback.
    for (const pos of [...cast.changingPositions].sort((a, b) => b - a)) pushYao(pos);
  }

  if (lines.length > maxRows) {
    // Only show the "…" when at least one oracle text survives above it — a
    // lone ellipsis (or a hint with no text beneath) is not a reading. The
    // renderer's contract is to skip cleanly and let the detail view be the
    // full reference, so drop the panel entirely in that case.
    const kept = lines.slice(0, Math.max(0, maxRows - 1));
    if (!kept.some((l) => l.role === "text")) return [];
    return [...kept, { text: "…", role: "more" }];
  }
  return lines;
}

/**
 * Rows the full (untruncated) panel wants at `width` — the figure the
 * settled-reveal layout reserves before the glyph gets to size itself.
 */
export function readingPanelRows(
  cast: Cast,
  language: DisplayLanguage,
  width: number,
): number {
  return buildReadingLines(cast, language, width, Number.MAX_SAFE_INTEGER).length;
}

/** Panel text width for a terminal width — single source for layout + render. */
export function readingPanelWidth(bufWidth: number): number {
  return Math.max(4, bufWidth - 8);
}
