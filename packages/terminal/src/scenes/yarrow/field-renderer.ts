// Yarrow field renderer — 4-stalks-per-cell block bar.
//
// One cell holds up to 4 stalks. Bottom-eighth fill levels mean each stalk is
// 2 of 8 levels inside its cell, so individual stalks are visible at the bar's
// edge as quarter-level drops; counting a full four is one cell extinguishing.
// The bar lives in a 15-cell footprint matching LINE_WIDTH; heaps are pinned
// at the outer edges of that footprint so the gap reflects depletion in place.
// At fuse the bar lifts upward and widens out to the line glyph.

import type { CellBuffer } from "../../render/buffer.ts";
import { getTheme } from "../../color/theme.ts";
import { stringWidth } from "../../layout/measure.ts";
import { renderLine } from "../cast/line-renderer.ts";
import { anchorRow, LINE_ROW_OFFSETS } from "../cast/hexagram-renderer.ts";
import { LINE_WIDTH } from "../../glyphs.ts";
import type { YarrowModel } from "./model.ts";

// ── Encoding ─────────────────────────────────────────────────────────────────

const STALKS_PER_CELL = 4;
const LEVELS = 8;
const LEVELS_PER_STALK = LEVELS / STALKS_PER_CELL; // 2
const FILL_CHARS = [" ", "▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

const BAR_AREA_WIDTH = LINE_WIDTH; // 15 — shared footprint with the line

/** Render `n` stalks as a string: full cells from left, optional partial cell. */
function stalkBar(n: number): string {
  if (n <= 0) return "";
  const full = Math.floor(n / STALKS_PER_CELL);
  const remStalks = n - full * STALKS_PER_CELL;
  const remLevel = Math.max(0, Math.min(LEVELS, Math.round(remStalks * LEVELS_PER_STALK)));
  return "█".repeat(full) + (remLevel > 0 ? FILL_CHARS[remLevel] : "");
}

/** Cells a stalk count occupies. */
function stalkWidth(n: number): number {
  return stalkBar(n).length;
}

function reverseStr(s: string): string {
  return [...s].reverse().join("");
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ── Braille helpers (kept for the settings-scene yarrow preview) ────────────

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

function barAreaStartCol(buf: CellBuffer): number {
  return Math.max(0, Math.floor((buf.width - BAR_AREA_WIDTH) / 2));
}

function fieldRow(buf: CellBuffer): number {
  return anchorRow(buf.height) + 5;
}

// ── Bar drawing ──────────────────────────────────────────────────────────────

/**
 * Draw a single (un-split) bar centered within the 15-cell footprint.
 * Used for gather, carry-complete, and pre-widen fuse.
 */
function drawWholeBar(
  buf: CellBuffer,
  row: number,
  areaStart: number,
  stalks: number,
  color: string,
): void {
  const str = stalkBar(stalks);
  const col = areaStart + Math.floor((BAR_AREA_WIDTH - str.length) / 2);
  buf.writeText(row, col, str, { fg: color });
}

/**
 * Draw a split bar — left heap pinned LEFT, right heap pinned RIGHT, gap fills
 * the middle. Partial cells live on each heap's inner (gap-facing) edge so
 * depletion shows there: stalks drain from the inner edge first, leaving the
 * gap wider.
 */
function drawSplitBar(
  buf: CellBuffer,
  row: number,
  areaStart: number,
  leftStalks: number,
  rightStalks: number,
  color: string,
): void {
  const leftStr = stalkBar(leftStalks); // full cells then partial — partial on inner side ✓
  const rightStr = reverseStr(stalkBar(rightStalks)); // partial first, then full — partial on inner side ✓
  if (leftStr.length > 0) {
    buf.writeText(row, areaStart, leftStr, { fg: color });
  }
  if (rightStr.length > 0) {
    buf.writeText(row, areaStart + BAR_AREA_WIDTH - rightStr.length, rightStr, { fg: color });
  }
}

/** Tray of tickmarks — one ▏ per stalk set aside (max 9). Accent color. */
function drawTray(
  buf: CellBuffer,
  row: number,
  areaStart: number,
  stalks: number,
  color: string,
): void {
  if (stalks <= 0) return;
  const trayCol = areaStart + BAR_AREA_WIDTH + 2;
  buf.writeText(row, trayCol, "▏".repeat(Math.min(9, Math.round(stalks))), { fg: color });
}

/** Floating "stalk between the fingers" — lifts above the bar during takeOne. */
function drawLiftedStalk(
  buf: CellBuffer,
  row: number,
  col: number,
  color: string,
): void {
  if (row < 0) return;
  buf.writeText(row, col, "▏", { fg: color });
}

// ── Hexagram lines (above the field) ─────────────────────────────────────────

function renderHexagramLines(buf: CellBuffer, model: YarrowModel): void {
  const t = getTheme();
  const anchor = anchorRow(buf.height);
  for (let i = 0; i < 6; i++) {
    const state = model.lines[i];
    if (state.progress <= 0) continue;
    // Skip the active line during fuse — the bar is mid-flight, owned below.
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
      drawWholeBar(buf, row, areaStart, model.fieldCount, t.primary);
      writeCentered(buf, row + 1, String(model.fieldCount), center, t.tertiary, true);
      break;
    }

    case "divide": {
      if (!round) break;
      drawSplitBar(buf, row, areaStart, round.splitAt, round.startCount - round.splitAt, t.primary);
      break;
    }

    case "takeOne": {
      if (!round) break;
      const rightStalks = round.startCount - round.splitAt;
      const takenStalks = model.takeOneProgress > 0 ? 1 : 0;
      drawSplitBar(buf, row, areaStart, round.splitAt, rightStalks - takenStalks, t.primary);
      // The floating stalk lifts from the right heap's inner (left-most) edge.
      const newRightWidth = stalkWidth(rightStalks - takenStalks);
      const liftCol = areaStart + BAR_AREA_WIDTH - newRightWidth - 1;
      const liftRow = row - Math.round(model.takeOneProgress * 2);
      drawLiftedStalk(buf, liftRow, liftCol, t.accent);
      break;
    }

    case "count": {
      if (!round) break;
      const leftStart = round.splitAt;
      const leftEnd = round.leftRemainder;
      const rightStart = round.startCount - round.splitAt - 1; // takeOne already gone
      const rightEnd = round.rightRemainder;
      const leftCurrent = lerp(leftStart, leftEnd, model.countProgress);
      const rightCurrent = lerp(rightStart, rightEnd, model.countProgress);
      drawSplitBar(buf, row, areaStart, leftCurrent, rightCurrent, t.primary);
      const counted = leftStart - leftCurrent + (rightStart - rightCurrent);
      drawTray(buf, row, areaStart, 1 + counted, t.accent);
      break;
    }

    case "tally": {
      if (!round) break;
      drawSplitBar(buf, row, areaStart, round.leftRemainder, round.rightRemainder, t.primary);
      drawTray(buf, row, areaStart, Math.round(model.tallyProgress * round.setAside), t.accent);
      writeCentered(buf, row + 1, `set aside ${round.setAside}`, center, t.tertiary, true);
      break;
    }

    case "carry": {
      if (!round) break;
      if (model.carryProgress < 1) {
        drawSplitBar(buf, row, areaStart, round.leftRemainder, round.rightRemainder, t.primary);
      } else {
        drawWholeBar(buf, row, areaStart, round.remaining, t.primary);
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
      const startWidth = stalkWidth(remaining); // e.g. 7 for 28 stalks
      const targetRow = anchorRow(buf.height) + LINE_ROW_OFFSETS[activeLine];

      const progress = model.lines[activeLine].progress;
      const LIFT_END = 0.65;
      const color = line.isChanging ? t.accent : t.primary;

      if (progress < LIFT_END) {
        // Lift + widen: bar travels up and grows outward toward the line's
        // 15-cell footprint. Same horizontal center throughout.
        const p = progress / LIFT_END;
        const currentRow = Math.round(lerp(row, targetRow, p));
        const currentWidth = Math.round(lerp(startWidth, BAR_AREA_WIDTH, p));
        const col = areaStart + Math.floor((BAR_AREA_WIDTH - currentWidth) / 2);
        buf.writeText(currentRow, col, "█".repeat(currentWidth), { fg: color });
      } else {
        // Crystallize: clear the bar area at the line row, then draw the line
        // glyph with renderLine — which animates center-outward.
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
