// reading-renderer.ts — the oracle texts of the reading, below the title block.
//
// Once the reveal settles, the texts a reading is classically made of appear:
// the changing lines' 爻辭 (bottom-line-first, as cast), or — when no lines
// move — the 卦辭, since the judgment IS the reading in that case. A single
// dim hint line states which text governs per the common classical rule.
// Quiet, observational, never interpretive.

import { type Cast, type DisplayLanguage, GUA, readingFocus, toSimplified } from "@iching/core";
import type { CellBuffer } from "../../render/buffer.ts";
import type { CastModel } from "./model.ts";
import { getTheme } from "../../color/theme.ts";
import { stringWidth } from "../../layout/measure.ts";
import { wordWrap } from "../dict/word-wrap.ts";
import { titleLayout } from "./reveal-renderer.ts";
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
 * Render the reading panel between the title block and the prompt bar.
 * Skips itself entirely when the terminal leaves no room — the detail
 * view remains the full reference.
 */
export function renderReadingPanel(
  buf: CellBuffer,
  model: CastModel,
  language: DisplayLanguage,
): void {
  const t = getTheme();
  const { baseRow, lines: titleLines } = titleLayout(buf, model, language);
  const endRow = buf.height - 3; // one row above the prompt bar

  // Prefer a breathing row after the title; surrender it when the texts
  // need the space.
  const gapStart = baseRow + titleLines.length + 1;
  const tightStart = baseRow + titleLines.length;
  const tightBudget = endRow - tightStart + 1;
  if (tightBudget < 1) return;

  const width = Math.max(4, buf.width - 8);
  const panel = buildReadingLines(model.cast, language, width, tightBudget);
  const startRow = panel.length <= endRow - gapStart + 1 ? gapStart : tightStart;

  for (let i = 0; i < panel.length; i++) {
    const row = startRow + i;
    if (row < 0 || row >= buf.height) break;
    const line = panel[i];
    const w = stringWidth(line.text);
    const col = Math.max(0, Math.floor((buf.width - w) / 2));
    if (line.role === "hint" || line.role === "more") {
      buf.writeText(row, col, line.text, { fg: t.tertiary, dim: true });
    } else {
      buf.writeText(row, col, line.text, { fg: t.secondary });
    }
  }
}
