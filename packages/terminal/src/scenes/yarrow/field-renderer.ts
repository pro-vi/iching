// Yarrow field renderer — block-character bar in the line's footprint.
//
// The field is rendered as a 15-cell bar (= LINE_WIDTH) at the same horizontal
// position the hexagram line will occupy. Stalks are encoded as bottom-eighth
// block fill levels (▁▂▃▄▅▆▇█) so the bar has substance — it can split, peel,
// and finally LIFT vertically into the line row and crystallize into the line
// glyph. Same 15 cells throughout: pure transport from substance to figure.
//
// Braille helpers from the earlier vocabulary stay exported for consumers
// (settings-scene's yarrow preview).

import type { CellBuffer } from "../../render/buffer.ts";
import { getTheme } from "../../color/theme.ts";
import { stringWidth } from "../../layout/measure.ts";
import { renderLine } from "../cast/line-renderer.ts";
import { anchorRow, LINE_ROW_OFFSETS } from "../cast/hexagram-renderer.ts";
import { LINE_WIDTH } from "../../glyphs.ts";
import type { YarrowModel } from "./model.ts";

// ── Block-fill primitives ────────────────────────────────────────────────────

const BAR_CELLS = LINE_WIDTH; // 15 — same footprint as the hexagram line
const LEVELS = 8;
const FILL_CHARS = [" ", "▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
const TOTAL_STALKS = 49;
// Density factor: the gather bar (49 stalks across 15 cells) sits at level 8.
const LEVELS_PER_STALK = (LEVELS * BAR_CELLS) / TOTAL_STALKS;

function levelFor(stalks: number, cells: number): number {
  if (cells <= 0 || stalks <= 0) return 0;
  return Math.max(0, Math.min(LEVELS, Math.round((stalks * LEVELS_PER_STALK) / cells)));
}

function fillCells(stalks: number, cells: number): string {
  if (cells <= 0) return "";
  return FILL_CHARS[levelFor(stalks, cells)].repeat(cells);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ── Braille primitives (kept for the settings-scene yarrow preview) ─────────

const BRAILLE_FILL_BITS = [0x01, 0x02, 0x04, 0x40, 0x08, 0x10, 0x20, 0x80];
const BRAILLE_BASE = 0x2800;

/** @deprecated bar vocabulary — kept for settings preview compatibility */
export function brailleCell(lit: number): string {
  let bits = 0;
  const n = Math.max(0, Math.min(8, lit));
  for (let i = 0; i < n; i++) bits |= BRAILLE_FILL_BITS[i];
  return String.fromCodePoint(BRAILLE_BASE + bits);
}

/** @deprecated bar vocabulary — kept for settings preview compatibility */
export function brailleStrand(count: number): string {
  const n = Math.max(0, count);
  const cells = Math.ceil(n / 8);
  let s = "";
  for (let c = 0; c < cells; c++) s += brailleCell(Math.min(8, n - c * 8));
  return s;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function writeCentered(
  buf: CellBuffer,
  row: number,
  text: string,
  center: number,
  color: string,
  dim = false,
): void {
  buf.writeText(row, center - Math.floor(stringWidth(text) / 2), text, { fg: color, dim });
}

/** Column the 15-cell bar starts at — same as the hexagram line. */
function barStartCol(buf: CellBuffer): number {
  return Math.max(0, Math.floor((buf.width - BAR_CELLS) / 2));
}

function fieldRow(buf: CellBuffer): number {
  return anchorRow(buf.height) + 5;
}

/** Cell position of the split in the 15-cell bar (a 1-cell gap lives here). */
function splitCellPos(splitAt: number, startCount: number): number {
  const raw = Math.round((splitAt / startCount) * (BAR_CELLS - 1));
  return Math.max(1, Math.min(BAR_CELLS - 2, raw));
}

// ── Beat renderers ───────────────────────────────────────────────────────────

/** Draw the bar as a single 15-cell run at the given stalk count and color. */
function drawWholeBar(
  buf: CellBuffer,
  row: number,
  startCol: number,
  stalks: number,
  color: string,
): void {
  buf.writeText(row, startCol, fillCells(stalks, BAR_CELLS), { fg: color });
}

/**
 * Draw a split bar — left + 1-cell gap + right — with independent fill levels.
 * gapWidens controls how visible the gap is (1 = single cell of space).
 */
function drawSplitBar(
  buf: CellBuffer,
  row: number,
  startCol: number,
  splitAt: number,
  startCount: number,
  leftStalks: number,
  rightStalks: number,
  color: string,
): void {
  const pos = splitCellPos(splitAt, startCount);
  const leftCells = pos;
  const rightCells = BAR_CELLS - pos - 1;
  buf.writeText(row, startCol, fillCells(leftStalks, leftCells), { fg: color });
  // gap is whatever the buffer already has (space) — leave it
  buf.writeText(row, startCol + pos + 1, fillCells(rightStalks, rightCells), { fg: color });
}

/** Render the accreting tally tray to the right of the bar. */
function drawTray(
  buf: CellBuffer,
  row: number,
  startCol: number,
  stalks: number,
  color: string,
): void {
  if (stalks <= 0) return;
  const trayCol = startCol + BAR_CELLS + 2;
  // One thin tickmark per stalk (▏ = 1/8-width left bar), accreting left→right.
  // setAside maxes at 9 → at most 9 cells of tickmarks. Fits well.
  buf.writeText(row, trayCol, "▏".repeat(Math.min(9, Math.round(stalks))), { fg: color });
}

// ── Hexagram lines (above) ───────────────────────────────────────────────────

function renderHexagramLines(buf: CellBuffer, model: YarrowModel): void {
  const t = getTheme();
  const anchor = anchorRow(buf.height);
  for (let i = 0; i < 6; i++) {
    const state = model.lines[i];
    if (state.progress <= 0) continue;
    // Skip the active line during fuse — the bar is mid-flight, owned by
    // the fuse renderer. Once fuse completes (settled) the next frame's
    // call into here paints it normally.
    if (model.beat === "fuse" && i === model.activeLine && !state.settled) continue;
    const line = model.cast.lines[i];
    const row = anchor + LINE_ROW_OFFSETS[i];
    if (row < 0 || row >= buf.height) continue;
    renderLine(
      buf,
      row,
      line.isYang,
      state.progress,
      line.isChanging ? t.accent : t.primary,
      0,
      line.isChanging ? "inline" : "gutter",
    );
  }
}

// ── Field (the bar) ──────────────────────────────────────────────────────────

function renderField(buf: CellBuffer, model: YarrowModel): void {
  const t = getTheme();
  const center = Math.floor(buf.width / 2);
  const startCol = barStartCol(buf);
  const row = fieldRow(buf);

  if (buf.width < 30) {
    if (model.beat !== "fuse" && model.beat !== "done") {
      writeCentered(buf, row, `${model.fieldCount} stalks`, center, t.primary);
    }
    return;
  }

  const round = model.currentRound();

  switch (model.beat) {
    case "idle":
    case "gather": {
      drawWholeBar(buf, row, startCol, model.fieldCount, t.primary);
      writeCentered(buf, row + 1, String(model.fieldCount), center, t.tertiary, true);
      break;
    }

    case "divide": {
      if (!round) break;
      drawSplitBar(
        buf, row, startCol,
        round.splitAt, round.startCount,
        round.splitAt, round.startCount - round.splitAt,
        t.primary,
      );
      // Brief highlight at the gap cell to draw the eye to where the cut fell.
      if (model.splitProgress < 1) {
        const pos = splitCellPos(round.splitAt, round.startCount);
        buf.writeText(row, startCol + pos, "·", { fg: t.accent });
      }
      break;
    }

    case "takeOne": {
      if (!round) break;
      const taken = model.takeOneProgress > 0 ? 1 : 0;
      drawSplitBar(
        buf, row, startCol,
        round.splitAt, round.startCount,
        round.splitAt, round.startCount - round.splitAt - taken,
        t.primary,
      );
      // The lifted stalk arcs upward from the right end of the bar.
      const lift = Math.round(model.takeOneProgress * 2);
      const liftRow = row - lift;
      if (liftRow >= 0) {
        buf.writeText(liftRow, startCol + BAR_CELLS - 1, "▏", { fg: t.accent });
      }
      break;
    }

    case "count": {
      if (!round) break;
      // Each heap drains from its starting stalks toward its remainder.
      const leftStart = round.splitAt;
      const leftEnd = round.leftRemainder;
      const rightStart = round.startCount - round.splitAt - 1; // takeOne already gone
      const rightEnd = round.rightRemainder;
      const leftCurrent = lerp(leftStart, leftEnd, model.countProgress);
      const rightCurrent = lerp(rightStart, rightEnd, model.countProgress);
      drawSplitBar(
        buf, row, startCol,
        round.splitAt, round.startCount,
        leftCurrent, rightCurrent,
        t.primary,
      );
      // Tray accretes: the takeOne + everything counted off so far.
      const counted =
        (leftStart - leftCurrent) + (rightStart - rightCurrent);
      drawTray(buf, row, startCol, 1 + counted, t.accent);
      break;
    }

    case "tally": {
      if (!round) break;
      // Bar shows the surviving stalks at remainder levels; tray at full setAside.
      drawSplitBar(
        buf, row, startCol,
        round.splitAt, round.startCount,
        round.leftRemainder, round.rightRemainder,
        t.primary,
      );
      const trayShown = Math.round(model.tallyProgress * round.setAside);
      drawTray(buf, row, startCol, trayShown, t.accent);
      writeCentered(buf, row + 1, `set aside ${round.setAside}`, center, t.tertiary, true);
      break;
    }

    case "carry": {
      if (!round) break;
      // The gap closes and the bar settles at `remaining` stalks.
      // At carryProgress 0: split form (remainders only); at 1: whole bar.
      const remaining = round.remaining;
      if (model.carryProgress < 1) {
        drawSplitBar(
          buf, row, startCol,
          round.splitAt, round.startCount,
          round.leftRemainder, round.rightRemainder,
          t.primary,
        );
      } else {
        drawWholeBar(buf, row, startCol, remaining, t.primary);
        writeCentered(buf, row + 1, String(remaining), center, t.tertiary, true);
      }
      break;
    }

    case "fuse": {
      // The bar lifts cell-by-cell to the line row, then crystallizes into
      // the hexagram line glyph. Same 15 cells, pure vertical transport.
      const activeLine = model.activeLine;
      if (activeLine < 0) break;
      const transcript = model.transcript[activeLine];
      const remaining = transcript.rounds[2].remaining;
      const line = transcript.line;

      const progress = model.lines[activeLine].progress;
      const targetRow = anchorRow(buf.height) + LINE_ROW_OFFSETS[activeLine];
      const LIFT_END = 0.7;

      if (progress < LIFT_END) {
        // Lift phase: bar travels from field row to target row.
        const liftP = progress / LIFT_END;
        const currentRow = Math.round(lerp(row, targetRow, liftP));
        drawWholeBar(buf, currentRow, startCol, remaining, t.primary);
      } else {
        // Crystallize phase: at target row, fill surges to full, then
        // resolves into the hexagram line glyph.
        const crystalP = (progress - LIFT_END) / (1 - LIFT_END);
        const baseLevel = levelFor(remaining, BAR_CELLS);
        if (crystalP < 0.55) {
          // Surge: bar fills to maximum.
          const surgeT = crystalP / 0.55;
          const level = Math.round(lerp(baseLevel, LEVELS, surgeT));
          buf.writeText(
            targetRow,
            startCol,
            FILL_CHARS[Math.max(0, Math.min(LEVELS, level))].repeat(BAR_CELLS),
            { fg: line.isChanging ? t.accent : t.primary },
          );
        } else {
          // Morph: render the hexagram line glyph in place.
          renderLine(
            buf,
            targetRow,
            line.isYang,
            1,
            line.isChanging ? t.accent : t.primary,
            0,
            line.isChanging ? "inline" : "gutter",
          );
        }
      }
      break;
    }

    case "done":
      // Ritual complete — the lines render via renderHexagramLines.
      break;
  }
}

// ── Chrome (caption + progress) ──────────────────────────────────────────────

function renderChrome(buf: CellBuffer, model: YarrowModel): void {
  const t = getTheme();
  const center = Math.floor(buf.width / 2);

  if (model.caption) {
    // Place the caption in the empty band between the hexagram and the field,
    // where the eye naturally lands. Was hidden under the footer at row h-2.
    writeCentered(buf, anchorRow(buf.height) + 2, model.caption, center, t.secondary);
  }

  if (model.activeLine >= 0 && model.activeLine < 6 && !model.hexagramComplete) {
    const label = `line ${model.activeLine + 1}/6  ·  round ${model.activeRound + 1}/3`;
    writeCentered(buf, 1, label, center, t.tertiary, true);
  }
}

// ── Entry ────────────────────────────────────────────────────────────────────

export function renderYarrowField(buf: CellBuffer, model: YarrowModel): void {
  renderHexagramLines(buf, model);
  renderField(buf, model);
  renderChrome(buf, model);
}
