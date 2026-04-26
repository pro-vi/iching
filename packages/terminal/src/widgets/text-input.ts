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

  /** Render the input field into a single CellBuffer row with cursor highlight. */
  render(
    buf: CellBuffer,
    row: number,
    col: number,
    width: number,
    style?: Partial<StyledCell>,
  ): void {
    let c = 0;
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
        if (c + w > width) {
          buf.writeText(row, col + c, " ", cellStyle);
          c += 1;
        } else {
          buf.writeText(row, col + c, ch, cellStyle);
          c += w;
        }
      } else {
        buf.writeText(row, col + c, " ", cellStyle);
        c += 1;
      }
      charIdx++;
    }
  }

  /** Render text wrapped across multiple rows. Returns the number of rows used (≥1, ≤ maxRows). */
  renderWrapped(
    buf: CellBuffer,
    row: number,
    col: number,
    width: number,
    maxRows: number,
    style?: Partial<StyledCell>,
  ): number {
    const chars = this._chars;
    const cursorStyle: Partial<StyledCell> = {
      ...style,
      bg: style?.fg ?? "#C8A96B",
      fg: style?.bg ?? "#0D1117",
    };

    let r = 0;
    let c = 0;
    let cursorR = 0;
    let cursorC = 0;

    for (let i = 0; i < chars.length; i++) {
      if (i === this.cursorPos) {
        cursorR = r;
        cursorC = c;
      }
      const ch = chars[i];
      const w = stringWidth(ch);
      if (c + w > width) {
        r++;
        c = 0;
        if (i === this.cursorPos) {
          cursorR = r;
          cursorC = c;
        }
      }
      if (r < maxRows) {
        buf.writeText(row + r, col + c, ch, style);
      }
      c += w;
    }

    if (this.cursorPos === chars.length) {
      cursorR = r;
      cursorC = c;
    }
    if (cursorC >= width) {
      cursorR++;
      cursorC = 0;
    }

    if (cursorR < maxRows) {
      const ch = this.cursorPos < chars.length ? chars[this.cursorPos] : " ";
      buf.writeText(row + cursorR, col + cursorC, ch, cursorStyle);
    }

    const lastContentRow = chars.length === 0 ? 0 : r;
    const usedRows = Math.max(lastContentRow, cursorR) + 1;
    return Math.min(maxRows, usedRows);
  }

  /** Compute how many rows would be used if rendered wrapped at the given width. */
  wrappedHeight(width: number): number {
    const chars = this._chars;
    let r = 0;
    let c = 0;
    let cursorR = 0;
    let cursorC = 0;

    for (let i = 0; i < chars.length; i++) {
      if (i === this.cursorPos) {
        cursorR = r;
        cursorC = c;
      }
      const w = stringWidth(chars[i]);
      if (c + w > width) {
        r++;
        c = 0;
        if (i === this.cursorPos) {
          cursorR = r;
          cursorC = c;
        }
      }
      c += w;
    }
    if (this.cursorPos === chars.length) {
      cursorR = r;
      cursorC = c;
    }
    if (cursorC >= width) cursorR++;

    return Math.max(r, cursorR) + 1;
  }
}
