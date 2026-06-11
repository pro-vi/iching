// reading-lines.ts — pure construction of the reading panel's text lines.
//
// Extracted from reading-renderer.ts so the reveal layout (which budgets
// vertical space between the glyph, the title block, and these texts) can
// measure the panel without an import cycle. The texts a reading is
// classically made of follow readingFocus (the common classical rule), and
// the text the hint names always comes first: the changing lines' 爻辭
// (governing line first when two or three move, the rest bottom-first as
// cast), the becoming hexagram's 卦辭 when four or five move, or — when no
// lines move — the primary 卦辭, since the judgment IS the reading in that
// case. A single dim hint line states which text governs. Quiet,
// observational, never interpretive.

import { type Cast, type DisplayLanguage, GUA, readingFocus, toSimplified } from "@iching/core";
import { wordWrap } from "../dict/word-wrap.ts";
import { tr, type MessageKey } from "../../i18n/messages.ts";

export interface ReadingLine {
  text: string;
  role: "hint" | "text" | "more";
}

const HINT_KEYS: Record<number, MessageKey> = {
  1: "cast.hint.one",
  2: "cast.hint.two",
  3: "cast.hint.three",
  4: "cast.hint.four",
  5: "cast.hint.five",
  6: "cast.hint.all",
};

/** The one-line reading-method hint for a cast (empty when no lines move). */
export function readingHint(cast: Cast, language: DisplayLanguage): string {
  const focus = readingFocus(cast);
  if (focus.kind === "judgment") return "";
  if (focus.kind === "extra") {
    return tr(language, focus.name === "用九" ? "cast.hint.allYong9" : "cast.hint.allYong6");
  }
  return tr(language, HINT_KEYS[cast.changingPositions.length]);
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
  const hint = readingHint(cast, language);
  if (hint) lines.push({ text: hint, role: "hint" });

  const pushText = (text: string): void => {
    for (const wl of wordWrap(text, width)) {
      lines.push({ text: wl, role: "text" });
    }
  };

  const pushYao = (pos: number): void => {
    pushText(
      english
        ? `${pos} · ${gua.yaoEn[pos - 1]}`
        : cn(gua.yao[pos - 1]),
    );
  };

  if (focus.kind === "judgment") {
    // No moving lines — the judgment is the reading.
    const label = tr(language, "cast.judgment");
    pushText(english ? `${label} · ${gua.gcEn}` : `${label} · ${cn(gua.gc)}`);
  } else if (focus.kind === "extra" && gua.extra) {
    // All six lines move on hex 1/2 — the 用九/用六 text governs.
    pushText(
      english
        ? `${gua.extra.name} · ${gua.extra.textEn}`
        : `${cn(gua.extra.name)} · ${cn(gua.extra.text)}`,
    );
  } else if (focus.kind === "becoming" && cast.becoming !== null) {
    // Four or five lines move (or all six off hex 1/2) — the becoming
    // hexagram's 卦辭 is the reading, exactly as the hint says.
    const becoming = GUA[cast.becoming - 1];
    const label = tr(language, "cast.becomingJudgment");
    pushText(english ? `${label} · ${becoming.gcEn}` : `${label} · ${cn(becoming.gc)}`);
  } else if (focus.kind === "lines") {
    // Two or three lines move — the governing (upper) line speaks first,
    // the other noted lines follow bottom-first as quieter context.
    pushYao(focus.governing);
    for (const pos of focus.positions) {
      if (pos !== focus.governing) pushYao(pos);
    }
  } else {
    // One changing line (or a fallback) — the 爻辭, bottom-line-first.
    const positions = [...cast.changingPositions].sort((a, b) => a - b);
    for (const pos of positions) pushYao(pos);
  }

  if (lines.length > maxRows) {
    return [...lines.slice(0, Math.max(0, maxRows - 1)), { text: "…", role: "more" }];
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
