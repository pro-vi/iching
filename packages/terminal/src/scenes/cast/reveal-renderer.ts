// reveal-renderer.ts — render title block below hexagram

import type { CellBuffer } from "../../render/buffer.ts";
import type { CastModel } from "./model.ts";
import { GUA, getStructure } from "@iching/core";
import { TEMPLE_NIGHT } from "../../color/themes/temple-night.ts";
import { stringWidth } from "../../layout/measure.ts";
import { anchorRow, TITLE_ROW_OFFSET } from "./hexagram-renderer.ts";

/**
 * Render the title block: Chinese name, pinyin, English, trigram meta.
 * Fade in based on titleProgress.
 */
export function renderTitle(
  buf: CellBuffer,
  model: CastModel,
): void {
  if (model.titleProgress <= 0) return;

  const anchor = anchorRow(buf.height);
  const baseRow = anchor + TITLE_ROW_OFFSET;
  const hexNum = model.cast.primary;
  const gua = GUA[hexNum - 1];
  const structure = getStructure(hexNum);

  // Line 1: Unicode symbol + Chinese name
  const line1 = `${gua.u} ${gua.n}`;
  // Line 2: Pinyin
  const line2 = gua.p;
  // Line 3: English — truncate to fit terminal width with some padding
  const maxWidth = Math.max(20, buf.width - 8);
  const line3 = stringWidth(gua.en) > maxWidth ? gua.en.slice(0, maxWidth - 1) + "…" : gua.en;
  // Line 4: Trigram meta
  const line4 = `${structure.upper.sym} above ${structure.lower.sym}`;

  const lines = [line1, line2, line3, line4];
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
      fg = lineProgress < 0.5 ? TEMPLE_NIGHT.stone : TEMPLE_NIGHT.bone;
    } else if (i === 3) {
      fg = TEMPLE_NIGHT.ash;
    } else {
      fg = lineProgress < 0.5 ? TEMPLE_NIGHT.ash : TEMPLE_NIGHT.stone;
    }

    const w = stringWidth(lines[i]);
    const col = Math.max(0, Math.floor((buf.width - w) / 2));
    buf.writeText(row, col, lines[i], { fg, dim: lineProgress < 0.3 });
  }

  // Subtitle ("unchanging" or becoming title)
  if (model.subtitleText) {
    const subRow = baseRow + 5;
    if (subRow < buf.height) {
      const w = stringWidth(model.subtitleText);
      const col = Math.max(0, Math.floor((buf.width - w) / 2));
      buf.writeText(subRow, col, model.subtitleText, {
        fg: TEMPLE_NIGHT.ash,
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
): void {
  if (model.becomingTitleProgress <= 0 || model.cast.becoming === null) return;

  const anchor = anchorRow(buf.height);
  const baseRow = anchor + TITLE_ROW_OFFSET + 6;
  const hexNum = model.cast.becoming;
  const gua = GUA[hexNum - 1];

  const arrow = "\u2192"; // →
  const line1 = `${arrow} ${gua.u} ${gua.n}`;
  const line2 = gua.p;

  const progress = model.becomingTitleProgress;

  const lines = [line1, line2];
  for (let i = 0; i < lines.length; i++) {
    const row = baseRow + i;
    if (row >= buf.height) break;

    const lineProgress = Math.max(0, Math.min(1, (progress - i * 0.2) / 0.6));
    if (lineProgress <= 0) continue;

    const fg = i === 0 ? TEMPLE_NIGHT.jade : TEMPLE_NIGHT.ash;
    const w = stringWidth(lines[i]);
    const col = Math.max(0, Math.floor((buf.width - w) / 2));
    buf.writeText(row, col, lines[i], { fg });
  }
}
