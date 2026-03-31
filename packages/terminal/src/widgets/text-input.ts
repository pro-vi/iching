// TextInput — character accumulator with cursor and CellBuffer rendering

import type { CellBuffer } from "../render/buffer.ts";
import type { StyledCell } from "../render/cell.ts";

export class TextInput {
  value: string;
  cursorPos: number;

  constructor() {
    this.value = "";
    this.cursorPos = 0;
  }

  /** Insert a character at cursor position */
  insert(char: string): void {
    this.value =
      this.value.slice(0, this.cursorPos) +
      char +
      this.value.slice(this.cursorPos);
    this.cursorPos += char.length;
  }

  /** Delete character before cursor */
  backspace(): void {
    if (this.cursorPos <= 0) return;
    this.value =
      this.value.slice(0, this.cursorPos - 1) +
      this.value.slice(this.cursorPos);
    this.cursorPos--;
  }

  /** Delete character at cursor */
  delete(): void {
    if (this.cursorPos >= this.value.length) return;
    this.value =
      this.value.slice(0, this.cursorPos) +
      this.value.slice(this.cursorPos + 1);
  }

  /** Move cursor left one position */
  moveCursorLeft(): void {
    if (this.cursorPos > 0) this.cursorPos--;
  }

  /** Move cursor right one position */
  moveCursorRight(): void {
    if (this.cursorPos < this.value.length) this.cursorPos++;
  }

  /** Move cursor to start */
  moveToStart(): void {
    this.cursorPos = 0;
  }

  /** Move cursor to end */
  moveToEnd(): void {
    this.cursorPos = this.value.length;
  }

  /** Clear all text */
  clear(): void {
    this.value = "";
    this.cursorPos = 0;
  }

  /** Render the input field into a CellBuffer row with cursor highlight */
  render(
    buf: CellBuffer,
    row: number,
    col: number,
    width: number,
    style?: Partial<StyledCell>,
  ): void {
    for (let i = 0; i < width; i++) {
      const charIdx = i;
      const ch = charIdx < this.value.length ? this.value[charIdx] : " ";
      const isCursor = charIdx === this.cursorPos;
      const cellStyle: Partial<StyledCell> = isCursor
        ? { ...style, bg: style?.fg ?? "#C8A96B", fg: style?.bg ?? "#0D1117" }
        : { ...style };
      buf.writeText(row, col + i, ch, cellStyle);
    }
  }
}
