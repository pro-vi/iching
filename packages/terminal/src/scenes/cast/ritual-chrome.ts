// Ritual chrome — canonical line/round counter and footer hint placement
// shared by every cast scene (coin auto, coin manual, yarrow auto, yarrow
// manual). One source of truth for the format, casing, and screen rows so
// the chrome doesn't drift method-by-method.
//
// Format choice (locked):
//   line N/M               — when there's no genuine sub-cycle (coin)
//   line N/M  ·  round K/T — when there is one (yarrow)
//
// Lowercase ambient, tight fractions, two-space middot. Row 1 for the
// header, height-2 for the footer. Scenes whose content fills the frame
// (e.g. CastScene's reveal) simply don't call these helpers.

import type { CellBuffer } from "../../render/buffer.ts";
import type { DisplayLanguage } from "@iching/core";
import { getTheme } from "../../color/theme.ts";
import { stringWidth } from "../../layout/measure.ts";
import { tr } from "../../i18n/messages.ts";

const HEADER_ROW = 1;
const FOOTER_ROW_FROM_BOTTOM = 2;

/**
 * Format the canonical position counter. The sub-counter is shown only
 * when there's a real sub-cycle to track — coin tosses are 1-of-1 per
 * line, so omitting `round` keeps the chrome honest.
 */
export function formatLineCounter(
  lineIdx: number,
  totalLines: number,
  round?: { idx: number; total: number },
  language: DisplayLanguage = "en",
): string {
  const base = `${tr(language, "chrome.line")} ${lineIdx + 1}/${totalLines}`;
  if (!round || round.total <= 1) return base;
  return `${base}  ·  ${tr(language, "chrome.round")} ${round.idx + 1}/${round.total}`;
}

/** Place the position counter at row 1, centered, dim tertiary color. */
export function writeChromeHeader(buf: CellBuffer, text: string): void {
  if (!text) return;
  const t = getTheme();
  const col = Math.max(0, Math.floor((buf.width - stringWidth(text)) / 2));
  buf.writeText(HEADER_ROW, col, text, { fg: t.tertiary, dim: true });
}

/** Place the action hint at height-2, centered, tertiary color. */
export function writeChromeFooter(buf: CellBuffer, text: string): void {
  if (!text) return;
  const t = getTheme();
  const row = buf.height - FOOTER_ROW_FROM_BOTTOM;
  if (row < 0) return;
  const col = Math.max(0, Math.floor((buf.width - stringWidth(text)) / 2));
  buf.writeText(row, col, text, { fg: t.tertiary });
}
