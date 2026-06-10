// reveal-renderer.ts — render title block below hexagram

import type { CellBuffer } from "../../render/buffer.ts";
import type { CastModel } from "./model.ts";
import { GUA, getStructure, toSimplified } from "@iching/core";
import type { DisplayLanguage } from "@iching/core";
import { getTheme } from "../../color/theme.ts";
import { stringWidth } from "../../layout/measure.ts";
import { anchorRow, TITLE_ROW_OFFSET } from "./hexagram-renderer.ts";
import { tr } from "../../i18n/messages.ts";

/**
 * Render the title block: Chinese name, pinyin, English, trigram meta.
 * Fade in based on titleProgress.
 */
export function renderTitle(
  buf: CellBuffer,
  model: CastModel,
  xOffset: number = 0,
  language: DisplayLanguage = "en",
): void {
  if (model.titleProgress <= 0) return;

  const t = getTheme();
  const anchor = anchorRow(buf.height);
  // Use focused hexagram — focusedHex is authoritative regardless of explorationMode
  const focusedKw = model.focusedHex === "becoming" && model.cast.becoming
    ? model.cast.becoming
    : model.cast.primary;

  const glyphEntry = model.focusedHex === "primary"
    ? model.primaryGlyphEntry
    : (model.becomingGlyphEntry ?? model.primaryGlyphEntry);
  const glyphHeight = glyphEntry?.height ?? 0;
  const hasGlyph = glyphHeight > 0 && (model.glyphAnimator !== null || model.glyphAnimDone);
  const baseRow = anchor + TITLE_ROW_OFFSET + (hasGlyph ? glyphHeight + 1 : 0);
  const gua = GUA[focusedKw - 1];
  const structure = getStructure(focusedKw);

  const isSplit = model.layout !== "centered";
  const english = language === "en";
  const cn = (s: string): string => (language === "zh-Hans" ? toSimplified(s) : s);
  // Structure connective: "above" (en) / "上" (zh) — catalog cast.trigramConnective.
  const structLine = `${structure.upper.sym} ${tr(language, "cast.trigramConnective")} ${structure.lower.sym}`;

  // When glyph is present: skip Chinese name (the glyph IS the name). In Chinese
  // modes, omit the English ename/image (no bilingual stacking) and convert names.
  let lines: string[];
  if (hasGlyph) {
    if (isSplit) {
      lines = [gua.p];
    } else if (english) {
      const maxWidth = Math.max(20, buf.width - 8);
      const enLine = stringWidth(gua.en) > maxWidth ? gua.en.slice(0, maxWidth - 1) + "…" : gua.en;
      lines = [gua.p, gua.ename ?? "", enLine, structLine];
    } else {
      lines = [gua.p, structLine];
    }
  } else {
    const line1 = `${gua.u} ${cn(gua.n)}`;
    const line2 = gua.p;
    if (isSplit) {
      lines = [line1, line2];
    } else if (english) {
      const maxWidth = Math.max(20, buf.width - 8);
      const line3 = stringWidth(gua.en) > maxWidth ? gua.en.slice(0, maxWidth - 1) + "…" : gua.en;
      lines = [line1, line2, line3, structLine];
    } else {
      lines = [line1, line2, structLine];
    }
  }
  const progress = model.titleProgress;

  for (let i = 0; i < lines.length; i++) {
    const row = baseRow + i;
    if (row >= buf.height) break;

    // Stagger: each line appears slightly later
    const lineProgress = Math.max(0, Math.min(1, (progress - i * 0.15) / 0.4));
    if (lineProgress <= 0) continue;

    // Color: dim initially, then brighter
    let fg: string;
    if (i === 0) {
      fg = lineProgress < 0.5 ? t.secondary : t.primary;
    } else if (i === 3) {
      fg = t.tertiary;
    } else {
      fg = lineProgress < 0.5 ? t.tertiary : t.secondary;
    }

    const w = stringWidth(lines[i]);
    const col = Math.max(0, Math.floor((buf.width - w) / 2) + xOffset);
    buf.writeText(row, col, lines[i], { fg, dim: lineProgress < 0.3 });
  }

  // Subtitle ("unchanging" or becoming title)
  if (model.subtitleText) {
    const subRow = baseRow + 5;
    if (subRow < buf.height) {
      const w = stringWidth(model.subtitleText);
      const col = Math.max(0, Math.floor((buf.width - w) / 2) + xOffset);
      buf.writeText(subRow, col, model.subtitleText, {
        fg: t.tertiary,
        dim: true,
      });
    }
  }
}

/**
 * Render the becoming title when morph is complete.
 */
export function renderBecomingTitle(
  buf: CellBuffer,
  model: CastModel,
  xOffset: number = 0,
  language: DisplayLanguage = "en",
): void {
  if (model.becomingTitleProgress <= 0 || model.cast.becoming === null) return;

  const t = getTheme();
  const anchor = anchorRow(buf.height);
  const isSplit = model.layout !== "centered";
  const glyphEntry = model.primaryGlyphEntry ?? model.becomingGlyphEntry;
  const glyphHeight = glyphEntry?.height ?? 0;
  const hasGlyph = glyphHeight > 0 && (model.glyphAnimator !== null || model.glyphAnimDone);
  const glyphOffset = hasGlyph ? glyphHeight + 1 : 0;
  // In split mode, becoming title renders at same row as primary title (not +6)
  const baseRow = anchor + TITLE_ROW_OFFSET + glyphOffset + (isSplit ? 0 : 6);
  const hexNum = model.cast.becoming;
  const gua = GUA[hexNum - 1];

  // In split mode, drop the arrow prefix. Convert the name in zh-Hans.
  const name = language === "zh-Hans" ? toSimplified(gua.n) : gua.n;
  const line1 = isSplit ? `${gua.u} ${name}` : `\u2192 ${gua.u} ${name}`;
  const line2 = gua.p;

  const progress = model.becomingTitleProgress;

  const lines = [line1, line2];
  for (let i = 0; i < lines.length; i++) {
    const row = baseRow + i;
    if (row >= buf.height) break;

    const lineProgress = Math.max(0, Math.min(1, (progress - i * 0.2) / 0.6));
    if (lineProgress <= 0) continue;

    const fg = i === 0 ? t.changingYin : t.tertiary;
    const w = stringWidth(lines[i]);
    const col = Math.max(0, Math.floor((buf.width - w) / 2) + xOffset);
    buf.writeText(row, col, lines[i], { fg });
  }
}
