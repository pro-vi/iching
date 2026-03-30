// right-hex-renderer.ts — render the right (becoming) hexagram in side-by-side layout

import type { CellBuffer } from "../../render/buffer.ts";
import type { StyledCell } from "../../render/cell.ts";
import type { CastModel } from "./model.ts";
import { renderLine } from "./line-renderer.ts";
import { GLYPHS, LINE_WIDTH } from "../../glyphs.ts";
import { TEMPLE_NIGHT } from "../../color/themes/temple-night.ts";
import { stringWidth } from "../../layout/measure.ts";
import { anchorRow, LINE_ROW_OFFSETS } from "./hexagram-renderer.ts";
import { morphFrame } from "./morph-renderer.ts";

/**
 * Render the right hexagram (becoming) in side-by-side mode.
 *
 * - Non-changing lines: render same as primary (original isYang)
 * - Changing lines with active morph (rightHexMorphProgress > 0 && not complete): skip (renderRightMorph handles)
 * - Changing lines with morph complete: render transformed (flipped isYang)
 */
export function renderRightHexagram(
  buf: CellBuffer,
  model: CastModel,
  xOffset: number,
): void {
  if (model.layout === "centered" || model.splitProgress <= 0) return;

  const anchor = anchorRow(buf.height);
  const changingPositions = model.cast.changingPositions;

  // Build a set of changing line indices (0-indexed) for quick lookup
  const changingSet = new Set(changingPositions.map((p) => p - 1));

  // Build a map from line index to changingPositions array index
  const ciMap = new Map<number, number>();
  for (let ci = 0; ci < changingPositions.length; ci++) {
    ciMap.set(changingPositions[ci] - 1, ci);
  }

  for (let i = 0; i < 6; i++) {
    const line = model.cast.lines[i];
    const row = anchor + LINE_ROW_OFFSETS[i];

    if (row < 0 || row >= buf.height) continue;

    if (changingSet.has(i)) {
      const ci = ciMap.get(i)!;
      const mp = model.rightHexMorphProgress[ci];

      // Active morph: skip — renderRightMorph handles it
      if (mp > 0 && !model.rightHexMorphComplete) continue;

      // Morph complete: render transformed line
      if (model.rightHexMorphComplete) {
        const transformedIsYang = !line.isYang;
        renderLine(buf, row, transformedIsYang, 1, TEMPLE_NIGHT.bone, xOffset);
        continue;
      }

      // Not yet morphing: render original
      renderLine(buf, row, line.isYang, 1, TEMPLE_NIGHT.bone, xOffset);
    } else {
      // Non-changing line: render same as primary
      renderLine(buf, row, line.isYang, 1, TEMPLE_NIGHT.bone, xOffset);
    }
  }
}

/**
 * Render morph animations on the right hexagram.
 * Similar to renderMorph but reads from model.rightHexMorphProgress.
 */
export function renderRightMorph(
  buf: CellBuffer,
  model: CastModel,
  xOffset: number,
): void {
  if (model.layout === "centered" || model.splitProgress <= 0) return;

  const anchor = anchorRow(buf.height);
  const changingPositions = model.cast.changingPositions;

  for (let ci = 0; ci < changingPositions.length; ci++) {
    const lineIndex = changingPositions[ci] - 1; // changingPositions is 1-indexed
    const mp = model.rightHexMorphProgress[ci];

    // Only render during active morph
    if (mp <= 0 || model.rightHexMorphComplete) continue;

    const line = model.cast.lines[lineIndex];
    const row = anchor + LINE_ROW_OFFSETS[lineIndex];

    if (row < 0 || row >= buf.height) continue;

    const isYangToYin = line.value === 9; // old yang morphs to yin
    const frameStr = morphFrame(isYangToYin, mp);

    // Color ramp during morph: jade/cinnabar -> glow -> bone
    let fg: string;
    if (mp < 0.33) {
      fg = isYangToYin ? TEMPLE_NIGHT.cinnabar : TEMPLE_NIGHT.jade;
    } else if (mp < 0.66) {
      fg = TEMPLE_NIGHT.glow;
    } else {
      fg = TEMPLE_NIGHT.bone;
    }

    const style: Partial<StyledCell> = { fg };
    const lineW = stringWidth(frameStr);
    const col = Math.max(0, Math.floor((buf.width - lineW) / 2) + xOffset);
    buf.writeText(row, col, frameStr, style);
  }
}
