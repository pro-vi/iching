// BrowseRenderer — render header, list rows, footer, search input

import type { CellBuffer } from "../../render/buffer.ts";
import type { SceneContext } from "../../scene/types.ts";
import type { BrowseModel } from "./browse-model.ts";
import type { TextInput } from "../../widgets/text-input.ts";
import { GUA, getStructure, toSimplified } from "@iching/core";
import type { DisplayLanguage } from "@iching/core";
import { getTheme } from "../../color/theme.ts";
import { stringWidth } from "../../layout/measure.ts";
import { tr } from "../../i18n/messages.ts";

const HEADER_ROWS = 2; // header + separator
const FOOTER_ROWS = 2; // separator + footer

/** Calculate how many list rows fit in the viewport */
export function listViewportHeight(termRows: number): number {
  return Math.max(1, termRows - HEADER_ROWS - FOOTER_ROWS);
}

/** Render the full browse scene */
export function renderBrowse(
  frame: CellBuffer,
  model: BrowseModel,
  textInput: TextInput,
  ctx: SceneContext,
): void {
  renderHeader(frame, model, textInput, ctx);
  renderList(frame, model, ctx);
  renderFooter(frame, model, ctx);
}

function renderHeader(
  frame: CellBuffer,
  model: BrowseModel,
  textInput: TextInput,
  ctx: SceneContext,
): void {
  const t = getTheme();
  const lang = ctx.language ?? "en";
  if (model.searchActive) {
    // Search mode header
    const label = tr(lang, "dict.searchPrompt");
    const labelW = stringWidth(label);
    frame.writeText(0, 1, label, { fg: t.accent });
    textInput.render(
      frame,
      0,
      1 + labelW,
      ctx.cols - 2 - labelW,
      { fg: t.primary },
    );
  } else {
    // Normal header
    const title = tr(lang, "dict.title");
    const hint = `[/] ${tr(lang, "verb.search")}`;
    frame.writeText(0, 1, title, { fg: t.primary, bold: true });
    frame.writeText(0, ctx.cols - stringWidth(hint) - 1, hint, {
      fg: t.secondary,
    });
  }

  // Separator line
  const sep = "─".repeat(ctx.cols);
  frame.writeText(1, 0, sep, { fg: t.tertiary });
}

function renderList(
  frame: CellBuffer,
  model: BrowseModel,
  ctx: SceneContext,
): void {
  const startRow = HEADER_ROWS;
  const listHeight = listViewportHeight(ctx.rows);
  const visibleEnd = Math.min(
    model.filtered.length,
    model.scrollOffset + listHeight,
  );

  // A query with no matches: one quiet centered line instead of a blank list
  // (a bare empty area reads like a rendering bug).
  if (model.filtered.length === 0) {
    const t = getTheme();
    const hint = tr(ctx.language ?? "en", "dict.emptyHint");
    const row = startRow + Math.floor(Math.max(0, listHeight - 1) / 2);
    const col = Math.max(1, Math.floor((ctx.cols - stringWidth(hint)) / 2));
    frame.writeText(row, col, hint, { fg: t.tertiary, dim: true });
    return;
  }

  for (let i = model.scrollOffset; i < visibleEnd; i++) {
    const row = startRow + (i - model.scrollOffset);
    if (row >= ctx.rows - FOOTER_ROWS) break;

    const hex = model.filtered[i];
    const kw = GUA.indexOf(hex) + 1;
    const isSelected = i === model.cursor;

    renderRow(frame, row, kw, hex, isSelected, ctx.cols, ctx.language ?? "en");
  }
}

function renderRow(
  frame: CellBuffer,
  row: number,
  kw: number,
  hex: { u: string; n: string; p: string; ename: string },
  isSelected: boolean,
  width: number,
  language: DisplayLanguage,
): void {
  const t = getTheme();
  const marker = isSelected ? ">" : " ";
  const kwStr = String(kw).padStart(3, " ");
  // Convert the hexagram name for zh-Hans; drop the English name in Chinese modes.
  const chinese = language === "zh-Hans" ? toSimplified(hex.n) : hex.n;
  const pinyin = hex.p;

  // Fixed column layout:
  //   col 0: marker, col 3: kw, col 8: hex symbol, col 11: chinese name
  //   chinese pads to width 4 (2 CJK chars), pinyin starts at col 16, english at col 27
  const chineseCol = 11;
  const chineseFixedWidth = 4;
  const pinyinCol = chineseCol + chineseFixedWidth + 1;
  const pinyinFixedWidth = 9;
  const enStart = pinyinCol + pinyinFixedWidth + 2;

  // Trigram pair (upper then lower, as in 山風蠱) — a dim structural cue in
  // the spare right column. Scanning the list teaches structure passively and
  // makes trigram-search results self-explanatory. Rendered where width allows.
  const structure = getStructure(kw);
  const pair = `${structure.upper.sym}${structure.lower.sym}`;
  const pairCol = width - stringWidth(pair) - 2;
  const showPair = pairCol >= enStart + 2;
  const enWidth = showPair
    ? Math.min(width - enStart - 1, pairCol - enStart - 2)
    : width - enStart - 1;

  const chineseWidth = stringWidth(chinese);
  const chinesePadded =
    chinese + " ".repeat(Math.max(0, chineseFixedWidth - chineseWidth));

  const ename =
    enWidth > 0 && hex.ename.length > enWidth
      ? hex.ename.slice(0, enWidth - 1) + "…"
      : hex.ename;

  const fg = isSelected ? t.primary : t.secondary;
  const bgStyle = isSelected ? { bg: t.dimmed } : {};

  // Write background for selected row
  if (isSelected) {
    for (let c = 0; c < width; c++) {
      frame.writeText(row, c, " ", bgStyle);
    }
  }

  frame.writeText(row, 0, ` ${marker}`, { fg: t.accent, ...bgStyle });
  frame.writeText(row, 3, kwStr, { fg, dim: !isSelected, ...bgStyle });
  frame.writeText(row, 8, hex.u, { fg, ...bgStyle });
  frame.writeText(row, chineseCol, chinesePadded, { fg, ...bgStyle });
  frame.writeText(row, pinyinCol, pinyin.padEnd(pinyinFixedWidth), {
    fg: isSelected ? t.accent : t.tertiary,
    ...bgStyle,
  });
  // English name column only in English mode (no stray English in Chinese modes).
  if (enWidth > 0 && language === "en") {
    frame.writeText(row, enStart, ename, { fg, ...bgStyle });
  }
  if (showPair) {
    frame.writeText(row, pairCol, pair, {
      fg: isSelected ? t.secondary : t.tertiary,
      dim: !isSelected,
      ...bgStyle,
    });
  }
}

function renderFooter(
  frame: CellBuffer,
  model: BrowseModel,
  ctx: SceneContext,
): void {
  const t = getTheme();
  const sepRow = ctx.rows - 2;
  const footerRow = ctx.rows - 1;

  // Separator
  const sep = "─".repeat(ctx.cols);
  frame.writeText(sepRow, 0, sep, { fg: t.tertiary });

  // Footer keybindings
  const lang = ctx.language ?? "en";
  const count = `${model.filtered.length} ${tr(lang, "dict.countSuffix")}`;
  const keys = model.searchActive
    ? `[↑↓] ${tr(lang, "verb.navigate")}  ·  [enter] ${tr(lang, "verb.open")}  ·  [esc] ${tr(lang, "verb.clearSearch")}`
    : `[↑↓] ${tr(lang, "verb.navigate")}  ·  [enter] ${tr(lang, "verb.open")}  ·  [/] ${tr(lang, "verb.search")}  ·  [esc] ${tr(lang, "verb.back")}`;

  frame.writeText(footerRow, 1, keys, { fg: t.secondary });
  frame.writeText(footerRow, ctx.cols - stringWidth(count) - 1, count, {
    fg: t.tertiary,
  });
}
