// reading-lines.ts — pure construction of the reading panel's text lines.
//
// Extracted from reading-renderer.ts so the reveal layout (which budgets
// vertical space between the glyph, the title block, and these texts) can
// measure the panel without an import cycle. The texts a reading is
// classically made of: the changing lines' 爻辭 (bottom-line-first, as
// cast), or — when no lines move — the 卦辭, since the judgment IS the
// reading in that case. A single dim hint line states which text governs
// per the common classical rule. Quiet, observational, never interpretive.

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
  } else {
    // The changing lines' 爻辭, bottom-line-first as cast.
    const positions = [...cast.changingPositions].sort((a, b) => a - b);
    for (const pos of positions) {
      pushText(
        english
          ? `${pos} · ${gua.yaoEn[pos - 1]}`
          : cn(gua.yao[pos - 1]),
      );
    }
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
