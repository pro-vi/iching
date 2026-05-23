// Yarrow field renderer — one cell = one stalk.
//
// Each stalk is a single `█` cell, arrayed horizontally. Take 1 out → bar is
// 1 cell narrower. Count off 4 → bar shrinks by 4 cells. Heaps pin to the
// outer edges of the bar area so the gap in the middle reflects depletion in
// place. The line-width mismatch (surviving 24–36 cells vs LINE_WIDTH 15) is
// resolved at fuse: the bar lifts AND compresses to 15 cells as it rises,
// then crystallizes into the line glyph — the substance consolidates into
// the form.

import type { CellBuffer } from "../../render/buffer.ts";
import { getTheme } from "../../color/theme.ts";
import { stringWidth } from "../../layout/measure.ts";
import { renderLine } from "../cast/line-renderer.ts";
import { anchorRow, LINE_ROW_OFFSETS } from "../cast/hexagram-renderer.ts";
import { LINE_WIDTH } from "../../glyphs.ts";
import type { YarrowModel } from "./model.ts";

// ── Stalk vocabulary ─────────────────────────────────────────────────────────

// A stalk is a single thin vertical mark — `│`, one per cell. Adjacent
// cells render as a fence of individual sticks (not a solid bar), so each
// stalk is countable and take-one events register as one stick vanishing.
const STALK = "│";
const TOTAL_STALKS = 49;
const GAP_CELLS = 2; // minimum visible gap between heaps during split
const BAR_AREA_WIDTH = TOTAL_STALKS + GAP_CELLS + 1; // 52 — fits any split

/** A row of N stalks: `███████` (n cells of `█`). */
function stalkBar(n: number): string {
  return STALK.repeat(Math.max(0, Math.round(n)));
}

function stalkWidth(n: number): number {
  return Math.max(0, Math.round(n));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ── Braille helpers (kept for the settings-scene yarrow preview) ─────────────

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

function fieldRow(buf: CellBuffer): number {
  return anchorRow(buf.height) + 5;
}

function barAreaStartCol(buf: CellBuffer): number {
  return Math.max(0, Math.floor((buf.width - BAR_AREA_WIDTH) / 2));
}

// ── Bar drawing ──────────────────────────────────────────────────────────────

/** Centered single bar (gather, carry-complete). */
function drawWholeBar(
  buf: CellBuffer,
  row: number,
  centerCol: number,
  stalks: number,
  color: string,
): void {
  const str = stalkBar(stalks);
  if (!str) return;
  buf.writeText(row, centerCol - Math.floor(str.length / 2), str, { fg: color });
}

/** Split bar — left pinned LEFT, right pinned RIGHT, gap in the middle. */
function drawSplitBar(
  buf: CellBuffer,
  row: number,
  areaStart: number,
  leftStalks: number,
  rightStalks: number,
  color: string,
): void {
  const leftStr = stalkBar(leftStalks);
  const rightStr = stalkBar(rightStalks);
  if (leftStr.length > 0) {
    buf.writeText(row, areaStart, leftStr, { fg: color });
  }
  if (rightStr.length > 0) {
    buf.writeText(row, areaStart + BAR_AREA_WIDTH - rightStr.length, rightStr, { fg: color });
  }
}

/** Tally tray to the right of the bar area — one `█` per stalk set aside. */
function drawTray(
  buf: CellBuffer,
  row: number,
  areaStart: number,
  stalks: number,
  color: string,
): void {
  if (stalks <= 0) return;
  const trayCol = areaStart + BAR_AREA_WIDTH + 2;
  const n = Math.min(9, Math.round(stalks));
  if (trayCol + n > buf.width) return; // clip if no room
  buf.writeText(row, trayCol, STALK.repeat(n), { fg: color });
}

/** Floating "stalk between the fingers" — lifts above the bar during takeOne. */
function drawLiftedStalk(
  buf: CellBuffer,
  row: number,
  col: number,
  color: string,
): void {
  if (row < 0) return;
  buf.writeText(row, col, STALK, { fg: color });
}

// ── Hexagram lines (above the field) ─────────────────────────────────────────

function renderHexagramLines(buf: CellBuffer, model: YarrowModel): void {
  const t = getTheme();
  const anchor = anchorRow(buf.height);
  for (let i = 0; i < 6; i++) {
    const state = model.lines[i];
    if (state.progress <= 0) continue;
    // Skip the active line during fuse — bar is mid-flight, owned below.
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
  const areaStart = barAreaStartCol(buf);
  const row = fieldRow(buf);

  // Narrow fallback — bar area is 52 cells; below ~56 the bar overflows.
  if (buf.width < 56) {
    if (model.beat !== "fuse" && model.beat !== "done") {
      writeCentered(buf, row, `${model.fieldCount} stalks`, center, t.primary);
    }
    return;
  }

  const round = model.currentRound();

  switch (model.beat) {
    case "idle":
    case "gather": {
      drawWholeBar(buf, row, center, model.fieldCount, t.primary);
      writeCentered(buf, row + 1, String(model.fieldCount), center, t.tertiary, true);
      break;
    }

    case "divide": {
      if (!round) break;
      // Cleave + spread: at splitProgress 0 the heaps sit adjacent (the bar
      // is continuous, centered); at 1 they're pinned to the outer edges of
      // the bar area with the gap fully open. Drives off model.splitProgress.
      const leftStalks = round.splitAt;
      const rightStalks = round.startCount - round.splitAt;
      const p = model.splitProgress;
      const wholeStart = center - Math.floor((leftStalks + rightStalks) / 2);
      const splitRightStart = areaStart + BAR_AREA_WIDTH - rightStalks;
      const leftCol = Math.round(lerp(wholeStart, areaStart, p));
      const rightCol = Math.round(lerp(wholeStart + leftStalks, splitRightStart, p));
      buf.writeText(row, leftCol, stalkBar(leftStalks), { fg: t.primary });
      buf.writeText(row, rightCol, stalkBar(rightStalks), { fg: t.primary });
      break;
    }

    case "takeOne": {
      if (!round) break;
      const rightStalks = round.startCount - round.splitAt;
      const taken = model.takeOneProgress > 0 ? 1 : 0;
      drawSplitBar(buf, row, areaStart, round.splitAt, rightStalks - taken, t.primary);
      // The lifted stalk rises from the cell the right heap just vacated.
      const newRightWidth = stalkWidth(rightStalks - taken);
      const liftCol = areaStart + BAR_AREA_WIDTH - newRightWidth - 1;
      const liftRow = row - Math.round(model.takeOneProgress * 3);
      drawLiftedStalk(buf, liftRow, liftCol, t.accent);
      break;
    }

    case "count": {
      if (!round) break;
      // Heaps drain as fours are counted off. The fours don't go to the tray —
      // they stay in play for the next round. Tray holds only the takeOne.
      const leftStart = round.splitAt;
      const leftEnd = round.leftRemainder;
      const rightStart = round.startCount - round.splitAt - 1;
      const rightEnd = round.rightRemainder;
      const leftCurrent = lerp(leftStart, leftEnd, model.countProgress);
      const rightCurrent = lerp(rightStart, rightEnd, model.countProgress);
      drawSplitBar(buf, row, areaStart, leftCurrent, rightCurrent, t.primary);
      drawTray(buf, row, areaStart, 1, t.accent);
      break;
    }

    case "tally": {
      if (!round) break;
      // The remainders MOVE from bar to tray. Bar drains to zero; tray grows
      // from 1 (takeOne) to setAside (1 + leftRem + rightRem).
      const remTotal = round.leftRemainder + round.rightRemainder;
      const leftInBar = round.leftRemainder * (1 - model.tallyProgress);
      const rightInBar = round.rightRemainder * (1 - model.tallyProgress);
      drawSplitBar(buf, row, areaStart, leftInBar, rightInBar, t.primary);
      const inTray = 1 + remTotal * model.tallyProgress;
      drawTray(buf, row, areaStart, inTray, t.accent);
      writeCentered(buf, row + 1, `set aside ${round.setAside}`, center, t.tertiary, true);
      break;
    }

    case "carry": {
      if (!round) break;
      // The counted-off fours return to form the next round's pile —
      // bar regrows from empty to `remaining` stalks.
      const currentStalks = Math.round(round.remaining * model.carryProgress);
      if (currentStalks > 0) {
        drawWholeBar(buf, row, center, currentStalks, t.primary);
      }
      if (model.carryProgress >= 1) {
        writeCentered(buf, row + 1, String(round.remaining), center, t.tertiary, true);
      }
      break;
    }

    case "fuse": {
      const activeLine = model.activeLine;
      if (activeLine < 0) break;
      const transcript = model.transcript[activeLine];
      const remaining = transcript.rounds[2].remaining;
      const line = transcript.line;
      const startWidth = stalkWidth(remaining);
      const targetRow = anchorRow(buf.height) + LINE_ROW_OFFSETS[activeLine];

      const progress = model.lines[activeLine].progress;
      const LIFT_END = 0.65;
      const color = line.isChanging ? t.accent : t.primary;

      if (progress < LIFT_END) {
        // Lift + compress: the bar travels up and narrows symmetrically
        // toward LINE_WIDTH. Same horizontal center throughout.
        const p = progress / LIFT_END;
        const currentRow = Math.round(lerp(row, targetRow, p));
        const currentWidth = Math.round(lerp(startWidth, LINE_WIDTH, p));
        drawWholeBar(buf, currentRow, center, currentWidth, color);
      } else {
        // Crystallize: clear the bar area at the target row, then draw the
        // line glyph via renderLine (center-outward reveal).
        const crystalP = (progress - LIFT_END) / (1 - LIFT_END);
        buf.writeText(targetRow, areaStart, " ".repeat(BAR_AREA_WIDTH), { fg: color });
        renderLine(
          buf,
          targetRow,
          line.isYang,
          crystalP,
          color,
          0,
          line.isChanging ? "inline" : "gutter",
        );
      }
      break;
    }

    case "done":
      break;
  }
}

// ── Chrome (caption + progress label) ────────────────────────────────────────

function renderChrome(buf: CellBuffer, model: YarrowModel): void {
  const t = getTheme();
  const center = Math.floor(buf.width / 2);

  if (model.caption) {
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
