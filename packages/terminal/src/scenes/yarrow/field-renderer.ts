// Braille field renderer for the yarrow ritual.
//
// The yarrow stalk of the terminal is the braille dot: a stalk is one dot, a
// "four" is one dot-column, a cell is two fours. The field is a strand of
// braille cells that cleaves, winnows, and finally rises into a hexagram line.

import type { CellBuffer } from "../../render/buffer.ts";
import { getTheme } from "../../color/theme.ts";
import { stringWidth } from "../../layout/measure.ts";
import { renderLine } from "../cast/line-renderer.ts";
import { anchorRow, LINE_ROW_OFFSETS } from "../cast/hexagram-renderer.ts";
import type { YarrowModel } from "./model.ts";

// Braille fill order — left column top-to-bottom (dots 1,2,3,7), then the
// right column (dots 4,5,6,8). A column of four is one "four"; two make a cell.
const FILL_BITS = [0x01, 0x02, 0x04, 0x40, 0x08, 0x10, 0x20, 0x80];
const BRAILLE_BASE = 0x2800;

/** Render `lit` dots (0-8) into a single braille cell, filled in fill order. */
export function brailleCell(lit: number): string {
  let bits = 0;
  const n = Math.max(0, Math.min(8, lit));
  for (let i = 0; i < n; i++) bits |= FILL_BITS[i];
  return String.fromCodePoint(BRAILLE_BASE + bits);
}

/** Render `count` stalks as a contiguous braille strand (8 dots per cell). */
export function brailleStrand(count: number): string {
  const n = Math.max(0, count);
  const cells = Math.ceil(n / 8);
  let s = "";
  for (let c = 0; c < cells; c++) {
    s += brailleCell(Math.min(8, n - c * 8));
  }
  return s;
}

/** Cells a strand of `count` dots occupies. */
function strandWidth(count: number): number {
  return Math.ceil(Math.max(0, count) / 8);
}

interface Segment {
  count: number;
  color: string;
}

/** Draw a run of contiguous strands; returns the total width drawn. */
function drawSegments(
  buf: CellBuffer,
  row: number,
  startCol: number,
  segments: Segment[],
): number {
  let col = startCol;
  for (const seg of segments) {
    if (seg.count <= 0) continue;
    buf.writeText(row, col, brailleStrand(seg.count), { fg: seg.color });
    col += strandWidth(seg.count);
  }
  return col - startCol;
}

function writeCentered(
  buf: CellBuffer,
  row: number,
  text: string,
  center: number,
  color: string,
  dim = false,
): void {
  buf.writeText(row, center - Math.floor(stringWidth(text) / 2), text, {
    fg: color,
    dim,
  });
}

/** Draw the hexagram figure — every line cast so far. */
function renderHexagramLines(buf: CellBuffer, model: YarrowModel): void {
  const t = getTheme();
  const anchor = anchorRow(buf.height);
  for (let i = 0; i < 6; i++) {
    const state = model.lines[i];
    if (state.progress <= 0) continue;
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

/** Draw the braille field workspace for the current beat. */
function renderField(buf: CellBuffer, model: YarrowModel): void {
  const t = getTheme();
  const center = Math.floor(buf.width / 2);
  const row = anchorRow(buf.height) + 5;
  const round = model.currentRound();

  // Narrow fallback: a plain count, no strand.
  if (buf.width < 30) {
    if (model.beat !== "fuse" && model.beat !== "done") {
      writeCentered(buf, row, `${model.fieldCount} stalks`, center, t.primary);
    }
    return;
  }

  switch (model.beat) {
    case "idle":
    case "gather": {
      const strand = brailleStrand(model.fieldCount);
      writeCentered(buf, row, strand, center, t.primary);
      writeCentered(buf, row + 1, String(model.fieldCount), center, t.tertiary, true);
      break;
    }

    case "divide":
    case "takeOne":
    case "count": {
      if (!round) break;
      const left = round.splitAt;
      const rightHeap = round.startCount - round.splitAt;

      let leftSegs: Segment[];
      let rightSegs: Segment[];
      let rightShown = rightHeap;

      if (model.beat === "count") {
        rightShown = rightHeap - 1; // one stalk already taken aside
        const leftSpent = Math.round(
          model.countProgress * (left - round.leftRemainder),
        );
        const rightSpent = Math.round(
          model.countProgress * (rightShown - round.rightRemainder),
        );
        leftSegs = [
          { count: leftSpent, color: t.tertiary },
          { count: left - leftSpent - round.leftRemainder, color: t.primary },
          { count: round.leftRemainder, color: t.accent },
        ];
        rightSegs = [
          { count: rightSpent, color: t.tertiary },
          { count: rightShown - rightSpent - round.rightRemainder, color: t.primary },
          { count: round.rightRemainder, color: t.accent },
        ];
      } else {
        if (model.beat === "takeOne" && model.takeOneProgress > 0) rightShown = rightHeap - 1;
        leftSegs = [{ count: left, color: t.primary }];
        rightSegs = [{ count: rightShown, color: t.primary }];
      }

      const gap =
        model.beat === "divide"
          ? 1 + Math.round(model.splitProgress * 4)
          : 5;
      const leftW = leftSegs.reduce((a, s) => a + strandWidth(s.count), 0);
      const rightW = rightSegs.reduce((a, s) => a + strandWidth(s.count), 0);
      const total = leftW + gap + rightW;
      const start = center - Math.floor(total / 2);

      drawSegments(buf, row, start, leftSegs);
      drawSegments(buf, row, start + leftW + gap, rightSegs);

      // The stalk set between the fingers, lifting clear of the right heap.
      if (model.beat === "takeOne" || model.beat === "count") {
        const lift = model.beat === "count" ? 2 : Math.round(model.takeOneProgress * 2);
        buf.writeText(row - lift, start + leftW + gap + rightW + 1, brailleCell(1), {
          fg: t.accent,
        });
      }
      break;
    }

    case "tally": {
      if (!round) break;
      const fieldStrand = brailleStrand(round.remaining);
      const trayShown = Math.round(model.tallyProgress * round.setAside);
      const fieldW = strandWidth(round.remaining);
      const trayW = strandWidth(trayShown);
      const gap = 4;
      const total = fieldW + gap + trayW;
      const start = center - Math.floor(total / 2);
      buf.writeText(row, start, fieldStrand, { fg: t.primary });
      if (trayShown > 0) {
        buf.writeText(row, start + fieldW + gap, brailleStrand(trayShown), {
          fg: t.accent,
        });
      }
      writeCentered(buf, row + 1, `set aside ${round.setAside}`, center, t.tertiary, true);
      break;
    }

    case "carry": {
      const remaining = round ? round.remaining : model.fieldCount;
      writeCentered(buf, row, brailleStrand(remaining), center, t.primary);
      writeCentered(buf, row + 1, String(remaining), center, t.tertiary, true);
      break;
    }

    case "fuse":
    case "done":
      // The field has become the line — nothing left to draw below.
      break;
  }
}

/** Draw the teach-once caption and the line/round progress indicator. */
function renderChrome(buf: CellBuffer, model: YarrowModel): void {
  const t = getTheme();
  const center = Math.floor(buf.width / 2);

  if (model.caption) {
    writeCentered(buf, anchorRow(buf.height) + 7, model.caption, center, t.tertiary, true);
  }

  if (model.activeLine >= 0 && model.activeLine < 6 && !model.hexagramComplete) {
    const label = `line ${model.activeLine + 1}/6  ·  round ${model.activeRound + 1}/3`;
    writeCentered(buf, 1, label, center, t.tertiary, true);
  }
}

/** Render the full yarrow ritual frame: hexagram, field, and chrome. */
export function renderYarrowField(buf: CellBuffer, model: YarrowModel): void {
  renderHexagramLines(buf, model);
  renderField(buf, model);
  renderChrome(buf, model);
}
