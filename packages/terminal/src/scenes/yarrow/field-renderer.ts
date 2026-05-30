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

/**
 * Geometry of the yarrow field for callers placing overlays on the same
 * coordinates the renderer uses (e.g. settings preview, H4 drag cursor).
 */
export function yarrowFieldGeometry(buf: CellBuffer): {
  fieldRow: number;
  areaStart: number;
  center: number;
} {
  return {
    fieldRow: fieldRow(buf),
    areaStart: barAreaStartCol(buf),
    center: Math.floor(buf.width / 2),
  };
}

/**
 * Draw the H6 sweeping aperture — `apertureWidth` consecutive stalks
 * starting at `apertureLeft` (a 1-indexed k value), recolored to accent
 * and flanked by bracket glyphs (`╞`, `╡`) on the cells just outside
 * the window. Color alone reads too subtle when the bar is downscaled
 * or when the sweep freezes after snap; the brackets give a non-color
 * cue that survives both. The brackets overwrite the immediately-
 * adjacent stalks (one on each side), so the aperture remains 4 stalks
 * wide but the outer boundary is unmistakable.
 *
 * The user authors WHERE to cut (which window); the system picks the
 * exact stalk inside the window via RNG, preserving yarrow's mod-4
 * distribution structurally (every 4-stalk window has exactly one
 * k % 4 === 0 and three non-zero).
 */
export function drawApertureCursor(
  buf: CellBuffer,
  fieldRow: number,
  center: number,
  apertureLeft: number,
  apertureWidth: number = 4,
  barWidth: number = TOTAL_STALKS,
): void {
  const accent = getTheme().accent;
  const barStart = center - Math.floor(barWidth / 2);
  // Inner stalks: recolor each cell to accent.
  for (let i = 0; i < apertureWidth; i++) {
    const k = apertureLeft + i;
    if (k < 1 || k > barWidth) continue;
    drawStalk(buf, fieldRow, barStart + k - 1, accent);
  }
  // Outer brackets — overwrite adjacent cells if they exist. Edge clamp:
  // when aperture sits at left edge (k=1) the left bracket is just outside
  // the bar; we suppress it rather than write into bar-area chrome.
  const leftBracketK = apertureLeft - 1;
  const rightBracketK = apertureLeft + apertureWidth;
  if (leftBracketK >= 1 && leftBracketK <= barWidth) {
    buf.writeText(fieldRow, barStart + leftBracketK - 1, "╞", { fg: accent });
  }
  if (rightBracketK >= 1 && rightBracketK <= barWidth) {
    buf.writeText(fieldRow, barStart + rightBracketK - 1, "╡", { fg: accent });
  }
}

/**
 * One cell of bounce-sweep — advance `apertureLeft` by one, reverse
 * `sweepDir` at the edges. Returned as a tuple so callers can destructure
 * back onto their own (private) fields without exposing them.
 *
 * Same atom shared by the live manual scene (driven by 150ms ticks while
 * the user holds the gesture) and the settings preview (driven by an
 * unattended timer).
 */
export function bounceAperture(
  apertureLeft: number,
  sweepDir: 1 | -1,
  min: number,
  max: number,
): [number, 1 | -1] {
  if (sweepDir === 1) {
    return apertureLeft >= max
      ? [Math.max(min, apertureLeft - 1), -1]
      : [apertureLeft + 1, 1];
  }
  return apertureLeft <= min
    ? [Math.min(max, apertureLeft + 1), 1]
    : [apertureLeft - 1, -1];
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

/** Tally tray to the right of the bar area — one stalk per stalk set aside. */
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

/**
 * Temporary "counted-off fours" holding zone — sits in the gap between heaps.
 * Each `▌` marker = one quartet of 4 stalks counted off. These stalks stay in
 * play (they re-form the next round's pile at carry), distinct from the
 * permanent set-aside tray on the right.
 */
function drawTempFours(
  buf: CellBuffer,
  row: number,
  areaStart: number,
  numQuartets: number,
  color: string,
): void {
  if (numQuartets <= 0) return;
  const str = "▌".repeat(numQuartets);
  const col = areaStart + Math.floor((BAR_AREA_WIDTH - str.length) / 2);
  buf.writeText(row, col, str, { fg: color });
}

/**
 * Write a single stalk cell at the given color. Used for the lifted-flyer
 * during takeOne, the operator-cursor overlay, and the H4 drag cursor —
 * all of which highlight via color alone (bold made `│` look thinner than
 * its neighbors in some terminals; substance vocabulary stays color-only).
 * Full bounds-check — out-of-frame writes no-op.
 */
function drawStalk(buf: CellBuffer, row: number, col: number, color: string): void {
  if (row < 0 || row >= buf.height || col < 0 || col >= buf.width) return;
  buf.writeText(row, col, STALK, { fg: color });
}

/**
 * Split a 0–1 progress into sequential left[0, 0.5] / right[0.5, 1] phases.
 * Used by count and tally beats (and the matching cursor overlay) so left
 * heap completes its action before right heap begins.
 */
function splitSeqProgress(p: number): { leftP: number; rightP: number } {
  return { leftP: Math.min(1, p * 2), rightP: Math.max(0, p * 2 - 1) };
}

/**
 * Position of the lifted-flyer stalk above the bar at takeOne progress p.
 * Same geometry used by the visible flyer and by the operator cursor — one
 * source of truth keeps them aligned.
 */
function flyerPosition(
  round: { startCount: number; splitAt: number },
  takeOneProgress: number,
  areaStart: number,
): { col: number; arcRows: number } {
  const rightStalksOriginal = round.startCount - round.splitAt;
  const startCol = areaStart + BAR_AREA_WIDTH - rightStalksOriginal;
  const trayCol = areaStart + BAR_AREA_WIDTH + 2;
  const col = Math.round(lerp(startCol, trayCol, takeOneProgress));
  const arcRows = Math.round(Math.sin(takeOneProgress * Math.PI) * 4);
  return { col, arcRows };
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
    // Read from the transcript (always populated for any line that's
    // progressed past 0) — model.cast may still be null in manual mode
    // until commitCast() runs after all 6 lines.
    const line = model.transcript[i]?.line;
    if (!line) continue;
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

/**
 * Render just the field strip at a caller-supplied row, without the
 * hexagram band or chrome. Used by both the full yarrow scene (via
 * `renderYarrowField`) and the settings preview, where the strip needs
 * to land inside a narrow preview region rather than the scene's
 * default position.
 *
 * The fuse beat references `LINE_ROW_OFFSETS[activeLine]` from the
 * hexagram band — preview callers must not reach `beat === "fuse"`.
 */
export function renderYarrowFieldStrip(buf: CellBuffer, model: YarrowModel, row: number): void {
  const t = getTheme();
  const center = Math.floor(buf.width / 2);
  const areaStart = barAreaStartCol(buf);

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
      // The lifted stalk arcs from the right heap's inner edge to the aside
      // tray's first cell. The heap loses the stalk; the flyer carries it.
      // At p=1 the flyer lands exactly where drawTray will place its first
      // stalk in the count beat — same character, same cell, no jump.
      const leftStalks = round.splitAt;
      const rightStalksOriginal = round.startCount - round.splitAt;
      const taken = model.takeOneProgress > 0 ? 1 : 0;
      drawSplitBar(buf, row, areaStart, leftStalks, rightStalksOriginal - taken, t.primary);
      if (model.takeOneProgress > 0) {
        const { col, arcRows } = flyerPosition(round, model.takeOneProgress, areaStart);
        drawStalk(buf, row - arcRows, col, t.accent);
      }
      break;
    }

    case "count": {
      if (!round) break;
      // Heaps drain sequentially — left first in [0, 0.5], right in [0.5, 1].
      // Reads as "a person counting one heap then the other," not "machine
      // counting both at once." Heaps are pinned to outer edges, so depletion
      // appears naturally at the inner (seam) edge. Counted-off fours don't
      // go to the tray — they accumulate as visible quartets in the gap,
      // because they stay in play for the next round. Tray holds the takeOne.
      const leftStart = round.splitAt;
      const leftEnd = round.leftRemainder;
      const rightStart = round.startCount - round.splitAt - 1;
      const rightEnd = round.rightRemainder;
      const { leftP, rightP } = splitSeqProgress(model.countProgress);
      const leftCurrent = lerp(leftStart, leftEnd, leftP);
      const rightCurrent = lerp(rightStart, rightEnd, rightP);
      drawSplitBar(buf, row, areaStart, leftCurrent, rightCurrent, t.primary);
      const countedOff = leftStart - leftCurrent + (rightStart - rightCurrent);
      const numQuartets = Math.floor(countedOff / 4);
      drawTempFours(buf, row, areaStart, numQuartets, t.secondary);
      drawTray(buf, row, areaStart, 1, t.accent);
      break;
    }

    case "tally": {
      if (!round) break;
      // Remainders move bar → tray sequentially — left remainder joins the
      // taken-aside first in [0, 0.5], then right remainder in [0.5, 1].
      // Matches the cursor's escort during the left/right peel phases. Temp
      // fours stay visible — they're carried forward, not set aside.
      const { leftP, rightP } = splitSeqProgress(model.tallyProgress);
      const leftInBar = round.leftRemainder * (1 - leftP);
      const rightInBar = round.rightRemainder * (1 - rightP);
      drawSplitBar(buf, row, areaStart, leftInBar, rightInBar, t.primary);
      const numQuartets = Math.round(round.remaining / 4);
      drawTempFours(buf, row, areaStart, numQuartets, t.secondary);
      const inTray = 1 + round.leftRemainder * leftP + round.rightRemainder * rightP;
      drawTray(buf, row, areaStart, inTray, t.accent);
      writeCentered(buf, row + 1, `set aside ${round.setAside}`, center, t.tertiary, true);
      break;
    }

    case "carry": {
      if (!round) break;
      // Temp fours migrate back to form the new round's pile — quartets
      // disappear as a centered bar of `remaining` stalks grows in. Both
      // sides driven by carryProgress: conservation is visible.
      const totalQuartets = Math.round(round.remaining / 4);
      const tempVisible = Math.round(totalQuartets * (1 - model.carryProgress));
      const stalksInBar = Math.round(round.remaining * model.carryProgress);
      if (stalksInBar > 0) {
        drawWholeBar(buf, row, center, stalksInBar, t.primary);
      }
      drawTempFours(buf, row, areaStart, tempVisible, t.secondary);
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

  // Operator-thread cursor — a styling overlay on the substance being touched
  // right now. Re-styles one existing cell with bold + accent color; never
  // creates a new glyph. Hidden during gather / fuse / done so the substance
  // can rest at the start of a round, and the line can own its arrival.
  applyOperatorCursor(buf, model, row, areaStart, center);
}

function applyOperatorCursor(
  buf: CellBuffer,
  model: YarrowModel,
  fieldRow: number,
  areaStart: number,
  center: number,
): void {
  const round = model.currentRound();
  if (!round) return;
  // Cursor highlights via color only — no bold. Bold rendering can make
  // monospace `│` look thinner/shorter than its neighbors in some terminals,
  // which reads as a visual artifact rather than emphasis. Accent vs primary
  // is enough contrast in divide/count; in tally the cursor merges with the
  // (already-accent) tray, which is correct — the tray is the destination.
  const c = getTheme().accent;

  switch (model.beat) {
    case "divide": {
      // Mark the cut edge — rightmost stalk of the left heap as it pulls away.
      // At p=0 the heaps are adjacent; at p=1 the left heap is pinned to the
      // outer edge. Cursor rides the inner-edge stalk throughout.
      const leftStalks = round.splitAt;
      const rightStalks = round.startCount - round.splitAt;
      const p = model.splitProgress;
      const wholeStart = center - Math.floor((leftStalks + rightStalks) / 2);
      const leftCol = Math.round(lerp(wholeStart, areaStart, p));
      drawStalk(buf, fieldRow, leftCol + leftStalks - 1, c);
      break;
    }
    case "takeOne": {
      // The lifted stalk IS the cursor — already drawn accent by the flyer.
      // No extra emphasis needed.
      break;
    }
    case "count": {
      // Cursor highlights the next stalk about to peel — inner edge of the
      // active heap (left in [0, 0.5], right in [0.5, 1]).
      const leftStart = round.splitAt;
      const leftEnd = round.leftRemainder;
      const rightStart = round.startCount - round.splitAt - 1;
      const rightEnd = round.rightRemainder;
      const { leftP, rightP } = splitSeqProgress(model.countProgress);
      if (model.countProgress < 0.5) {
        const leftCurrent = lerp(leftStart, leftEnd, leftP);
        drawStalk(buf, fieldRow, areaStart + Math.ceil(leftCurrent) - 1, c);
      } else if (rightStart > 0) {
        const rightCurrent = lerp(rightStart, rightEnd, rightP);
        drawStalk(buf, fieldRow, areaStart + BAR_AREA_WIDTH - Math.ceil(rightCurrent), c);
      }
      break;
    }
    // tally: cursor hidden. The tray cells are already drawn at accent
    // by `drawTray`, so a same-color cursor on the latest cell has no
    // visible effect. Either accept the merge (which makes the cursor a
    // lie) or differentiate, which would require a new highlight idiom
    // (bold causes the "thinner stalk" artifact). Cleaner to omit — the
    // tally beat's story is told by the tray growing, not by a focus mark.
    // carry: cursor hidden. The temp-fours quartets (`▌`) live in the same
    // centered region as the gathering bar; a cursor `│` at center would
    // overwrite a `▌` and look like a thinner stalk. The beat is short and
    // its story is "substance returns" — the operator-thread isn't needed.
    // gather / fuse / idle / done: cursor hidden — substance is at rest or
    // the line is becoming itself. Manual scene's waiting phase lands here
    // too (beat === "gather", all progresses === 0).
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
  renderYarrowFieldStrip(buf, model, fieldRow(buf));
  renderChrome(buf, model);
}
