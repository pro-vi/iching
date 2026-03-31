// TextInput — character accumulator with cursor and CellBuffer rendering

import type { CellBuffer } from "../render/buffer.ts";
import type { StyledCell } from "../render/cell.ts";
import { stringWidth } from "../layout/measure.ts";

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
    // Walk characters by display width, not string index
    let c = 0; // current column offset
    let charIdx = 0;
    const chars = [...this.value]; // iterate graphemes
    while (c < width) {
      const isCursor = charIdx === this.cursorPos;
      const cellStyle: Partial<StyledCell> = isCursor
        ? { ...style, bg: style?.fg ?? "#C8A96B", fg: style?.bg ?? "#0D1117" }
        : { ...style };

      if (charIdx < chars.length) {
        const ch = chars[charIdx];
        const w = stringWidth(ch);
        buf.writeText(row, col + c, ch, cellStyle);
        c += w;
      } else {
        buf.writeText(row, col + c, " ", cellStyle);
        c += 1;
      }
      charIdx++;
    }
  }
}
