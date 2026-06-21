// DiffRenderer — compare prev/next CellBuffer, emit minimal ANSI patch

import { CellBuffer } from "./buffer.ts";
import { type StyledCell, cellsEqual } from "./cell.ts";
import { cursorTo, clearToEndOfLine, syncOutputOn, syncOutputOff } from "../ansi/codes.ts";
import { fgColor, bgColor, boldStyle, dimStyle, resetStyle } from "../ansi/sgr.ts";
import { detectColorSupport, type ColorSupport } from "../color/detect.ts";

/**
 * The final output-boundary guard: a cell should only ever carry a printable
 * glyph, but setCell bypasses writeText's stripping, so the renderer must be the
 * last line — a stray control (ESC/CSI/OSC/CR/BEL/C1) emitted raw would be
 * EXECUTED by the terminal. Replace any control with U+FFFD. (Render review, H5.)
 */
function safeCellChar(char: string): string {
  return /[\u0000-\u001f\u007f-\u009f]/.test(char) ? "\uFFFD" : char;
}

/**
 * Move to the start of `row` and clear it. Reset style BEFORE the clear:
 * clearToEndOfLine erases using the current SGR background, so a leftover bg from
 * the previous row would paint the cleared span. (Render review, H2.)
 */
function clearRow(chunks: string[], row: number): void {
  chunks.push(cursorTo(row, 0));
  chunks.push(resetStyle());
  chunks.push(clearToEndOfLine);
}

export class DiffRenderer {
  private output: { write(data: string): boolean };
  private colorSupport: ColorSupport;

  constructor(
    output?: { write(data: string): boolean },
    colorSupport?: ColorSupport,
  ) {
    this.output = output ?? process.stdout;
    this.colorSupport = colorSupport ?? detectColorSupport();
  }

  /**
   * Compare prev and next buffers row-by-row.
   * Emit cursor-move + styled text only for changed rows.
   * All output collected into a single write() call.
   */
  present(prev: CellBuffer, next: CellBuffer): void {
    const chunks: string[] = [];

    for (let row = 0; row < next.height; row++) {
      if (this.rowsEqual(prev, next, row)) continue;

      // Clear the changed row before repainting it.
      clearRow(chunks, row);

      // Emit styled cells for the entire row
      let lastFg: string | undefined;
      let lastBg: string | undefined;
      let lastBold = false;
      let lastDim = false;

      for (let col = 0; col < next.width; col++) {
        const cell = next.getCell(row, col);

        // Skip continuation cells from wide (CJK) characters —
        // the terminal already advanced past this column when it
        // rendered the wide char. Writing a space here would shift
        // all subsequent characters right.
        if (cell.char === "") continue;

        // Check if style changed
        const fgChanged = cell.fg !== lastFg;
        const bgChanged = cell.bg !== lastBg;
        const boldChanged = (cell.bold ?? false) !== lastBold;
        const dimChanged = (cell.dim ?? false) !== lastDim;

        if (fgChanged || bgChanged || boldChanged || dimChanged) {
          chunks.push(resetStyle());
          if (cell.fg) chunks.push(fgColor(cell.fg, this.colorSupport));
          if (cell.bg) chunks.push(bgColor(cell.bg, this.colorSupport));
          if (cell.bold) chunks.push(boldStyle());
          if (cell.dim) chunks.push(dimStyle());
          lastFg = cell.fg;
          lastBg = cell.bg;
          lastBold = cell.bold ?? false;
          lastDim = cell.dim ?? false;
        }

        chunks.push(safeCellChar(cell.char) || " ");
      }

      // Reset at end of row
      chunks.push(resetStyle());
    }

    // The buffer shrank (terminal got shorter): rows from next.height up to
    // prev.height were painted last frame but the loop above never visits them,
    // so they'd linger as stale content below the new frame. Clear each. The
    // scene loop also does a full clear on resize, so this is the renderer's own
    // safety net rather than the sole guard. (Render review, H1.)
    for (let row = next.height; row < prev.height; row++) {
      clearRow(chunks, row);
    }

    // Single write for the entire frame, wrapped in synchronized-output
    // guards (DEC 2026) so busy frames present atomically without tearing.
    if (chunks.length > 0) {
      this.output.write(syncOutputOn + chunks.join("") + syncOutputOff);
    }
  }

  private rowsEqual(a: CellBuffer, b: CellBuffer, row: number): boolean {
    // Use max width so new content in wider buffer is detected after resize
    const maxW = Math.max(a.width, b.width);
    for (let col = 0; col < maxW; col++) {
      if (!cellsEqual(a.getCell(row, col), b.getCell(row, col))) return false;
    }
    return true;
  }
}
