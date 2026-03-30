// CellBuffer — 2D grid of StyledCells

import { type StyledCell, EMPTY_CELL } from "./cell.ts";
import { stringWidth } from "../layout/measure.ts";

export class CellBuffer {
  readonly width: number;
  readonly height: number;
  private cells: StyledCell[];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.cells = new Array(width * height);
    this.clear();
  }

  /** Set a single cell. Out-of-bounds is a no-op. */
  setCell(row: number, col: number, cell: StyledCell): void {
    if (row < 0 || row >= this.height || col < 0 || col >= this.width) return;
    this.cells[row * this.width + col] = cell;
  }

  /** Get a single cell. Out-of-bounds returns EMPTY_CELL. */
  getCell(row: number, col: number): StyledCell {
    if (row < 0 || row >= this.height || col < 0 || col >= this.width) {
      return EMPTY_CELL;
    }
    return this.cells[row * this.width + col];
  }

  /**
   * Write a string starting at (row, col), applying optional style.
   * Handles wide characters (CJK) by consuming extra columns.
   */
  writeText(
    row: number,
    col: number,
    text: string,
    style?: Partial<StyledCell>,
  ): void {
    let c = col;
    for (const ch of text) {
      if (c >= this.width) break;
      const w = stringWidth(ch);
      this.setCell(row, c, { char: ch, ...style });
      // For wide characters, fill the next column with an empty continuation cell
      if (w === 2 && c + 1 < this.width) {
        this.setCell(row, c + 1, { char: "", ...style });
      }
      c += w;
    }
  }

  /** Reset all cells to empty spaces. */
  clear(): void {
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i] = { ...EMPTY_CELL };
    }
  }

  /** Get a row as an array of cells (for diff comparison). */
  getRow(row: number): StyledCell[] {
    const start = row * this.width;
    return this.cells.slice(start, start + this.width);
  }

  /** Factory method. */
  static create(width: number, height: number): CellBuffer {
    return new CellBuffer(width, height);
  }
}
