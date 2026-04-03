// TextInput — character accumulator with cursor and CellBuffer rendering

import type { CellBuffer } from "../render/buffer.ts";
import type { StyledCell } from "../render/cell.ts";
import { stringWidth } from "../layout/measure.ts";

export class TextInput {
  /** Internal storage as array of code points (handles surrogate pairs correctly) */
  private _chars: string[];
  cursorPos: number;

  constructor() {
    this._chars = [];
    this.cursorPos = 0;
  }

  /** Get the string value (joined from internal code-point array) */
  get value(): string {
    return this._chars.join("");
  }

  /** Set the string value (splits into code points) */
  set value(str: string) {
    this._chars = [...str];
  }

  /** Insert a character (or grapheme cluster) at cursor position */
  insert(char: string): void {
    const chars = [...char];
    this._chars.splice(this.cursorPos, 0, ...chars);
    this.cursorPos += chars.length;
  }

  /** Delete character before cursor */
  backspace(): void {
    if (this.cursorPos <= 0) return;
    this._chars.splice(this.cursorPos - 1, 1);
    this.cursorPos--;
  }

  /** Delete character at cursor */
  delete(): void {
    if (this.cursorPos >= this._chars.length) return;
    this._chars.splice(this.cursorPos, 1);
  }

  /** Move cursor left one position */
  moveCursorLeft(): void {
    if (this.cursorPos > 0) this.cursorPos--;
  }

  /** Move cursor right one position */
  moveCursorRight(): void {
    if (this.cursorPos < this._chars.length) this.cursorPos++;
  }

  /** Move cursor to start */
  moveToStart(): void {
    this.cursorPos = 0;
  }

  /** Move cursor to end */
  moveToEnd(): void {
    this.cursorPos = this._chars.length;
  }

  /** Clear all text */
  clear(): void {
    this._chars = [];
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
    const chars = this._chars;
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
