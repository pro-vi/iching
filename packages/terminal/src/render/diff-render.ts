// DiffRenderer — compare prev/next CellBuffer, emit minimal ANSI patch

import { CellBuffer } from "./buffer.ts";
import { type StyledCell, cellsEqual } from "./cell.ts";
import { cursorTo, clearToEndOfLine } from "../ansi/codes.ts";
import { fgColor, bgColor, boldStyle, dimStyle, resetStyle } from "../ansi/sgr.ts";
import { detectColorSupport, type ColorSupport } from "../color/detect.ts";

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

      // Emit cursor move to start of changed row, clear it first
      chunks.push(cursorTo(row, 0));
      chunks.push(clearToEndOfLine);

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

        chunks.push(cell.char || " ");
      }

      // Reset at end of row
      chunks.push(resetStyle());
    }

    // Single write for the entire frame
    if (chunks.length > 0) {
      this.output.write(chunks.join(""));
    }
  }

  private rowsEqual(a: CellBuffer, b: CellBuffer, row: number): boolean {
    for (let col = 0; col < a.width; col++) {
      if (!cellsEqual(a.getCell(row, col), b.getCell(row, col))) return false;
    }
    return true;
  }
}
