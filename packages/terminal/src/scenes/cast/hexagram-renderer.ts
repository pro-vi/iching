// hexagram-renderer.ts — render all 6 hexagram lines with trigram gap and markers

import type { CellBuffer } from "../../render/buffer.ts";
import type { CastModel } from "./model.ts";
import { renderLine } from "./line-renderer.ts";
import { GLYPHS, LINE_WIDTH } from "../../glyphs.ts";
import { getTheme } from "../../color/theme.ts";
import { stringWidth } from "../../layout/measure.ts";

/**
 * Row offsets for each line relative to the bottom anchor row.
 *
 * Lines are drawn bottom-to-top (line 1 at bottom, line 6 at top).
 * Trigram gap: 2 blank rows between lines 3 and 4.
 *
 * Line 6 (top):    anchor - 12
 * Line 5:          anchor - 10
 * Line 4:          anchor - 8
 *   (trigram gap)
 * Line 3:          anchor - 5
 * Line 2:          anchor - 3
 * Line 1 (bottom): anchor - 1
 */
export const LINE_ROW_OFFSETS = [-1, -3, -5, -8, -10, -12];

/** Coin toss area: 2 rows above the current line being drawn. */
export const COIN_ROW_OFFSET = -2;

/** Title area offsets from anchor. */
export const TITLE_ROW_OFFSET = 1;

/**
 * Compute the anchor row (bottom of hexagram) given terminal height.
 * Centered vertically with some bias toward upper-middle.
 */
export function anchorRow(rows: number): number {
  // Place hexagram so line 1 is slightly below center
  return Math.floor(rows / 2) + 3;
}

/**
 * Render the full hexagram into the buffer.
 */
export function renderHexagram(
  buf: CellBuffer,
  model: CastModel,
  xOffset: number = 0,
): void {
  const t = getTheme();
  const anchor = anchorRow(buf.height);

  // Dim primary hex when becoming is focused (during reveal or exploration)
  const explDim = model.focusedHex === "becoming";

  for (let i = 0; i < 6; i++) {
    const lineState = model.lines[i];
    const line = model.cast.lines[i];
    const row = anchor + LINE_ROW_OFFSETS[i];

    if (row < 0 || row >= buf.height) continue;

    // Determine color override for glow effects
    let color: string | undefined;
    if (explDim) {
      color = t.tertiary;
    } else if (model.glowProgress > 0 && model.hexagramComplete) {
      // Whole-figure glow
      const g = model.glowProgress;
      if (g < 0.5) {
        color = t.accent;
      } else {
        color = t.primary;
      }
    }
    if (lineState.glowing && lineState.glowProgress > 0) {
      // Changing line pulse — overrides whole glow
      const isYangChanging = line.value === 9; // old yang
      if (lineState.glowProgress < 0.33) {
        color = isYangChanging ? t.accent : t.changingYin;
      } else if (lineState.glowProgress < 0.66) {
        color = isYangChanging ? t.selected : t.changingYin;
      } else {
        color = isYangChanging ? t.accent : t.changingYin;
      }
    }

    // If morph is in progress, skip normal rendering (morph-renderer handles it)
    if (lineState.morphProgress > 0 && !lineState.morphComplete) continue;

    // If morph is complete, render the transformed line
    if (lineState.morphComplete) {
      // After morph: yang becomes yin, yin becomes yang
      const transformedIsYang = !line.isYang;
      renderLine(buf, row, transformedIsYang, 1, color ?? t.primary, xOffset);
    } else {
      renderLine(buf, row, line.isYang, lineState.progress, color, xOffset);
    }

    // Gutter markers for changing lines
    if (lineState.markerVisible && line.isChanging) {
      const centerCol = Math.floor(buf.width / 2) + xOffset;
      const halfLine = Math.floor(LINE_WIDTH / 2);
      const markerCol = centerCol + halfLine + 2; // 2 cols right of line
      const marker =
        line.value === 9
          ? GLYPHS.changingMarkerYang
          : GLYPHS.changingMarkerYin;
      const markerColor =
        line.value === 9 ? t.accent : t.changingYin;
      buf.writeText(row, markerCol, marker, { fg: markerColor });
    }
  }
}
