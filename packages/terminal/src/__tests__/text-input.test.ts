import { describe, test, expect } from "bun:test";
import { TextInput } from "../widgets/text-input.ts";
import { CellBuffer } from "../render/buffer.ts";

describe("TextInput", () => {
  test("starts empty", () => {
    const input = new TextInput();
    expect(input.value).toBe("");
    expect(input.cursorPos).toBe(0);
  });

  test("insert adds characters at cursor", () => {
    const input = new TextInput();
    input.insert("h");
    input.insert("i");
    expect(input.value).toBe("hi");
    expect(input.cursorPos).toBe(2);
  });

  test("backspace removes character before cursor", () => {
    const input = new TextInput();
    input.insert("abc");
    input.backspace();
    expect(input.value).toBe("ab");
    expect(input.cursorPos).toBe(2);
  });

  test("backspace at start does nothing", () => {
    const input = new TextInput();
    input.backspace();
    expect(input.value).toBe("");
    expect(input.cursorPos).toBe(0);
  });

  test("delete removes character at cursor", () => {
    const input = new TextInput();
    input.insert("abc");
    input.moveToStart();
    input.delete();
    expect(input.value).toBe("bc");
    expect(input.cursorPos).toBe(0);
  });

  test("delete at end does nothing", () => {
    const input = new TextInput();
    input.insert("abc");
    input.delete();
    expect(input.value).toBe("abc");
  });

  test("deleteWord removes the word before the cursor", () => {
    const input = new TextInput();
    input.insert("what needs patience");
    input.deleteWord();
    expect(input.value).toBe("what needs ");
    expect(input.cursorPos).toBe(11);
  });

  test("deleteWord skips trailing spaces, then the word", () => {
    const input = new TextInput();
    input.insert("hello world   ");
    input.deleteWord();
    expect(input.value).toBe("hello ");
  });

  test("deleteWord at start does nothing", () => {
    const input = new TextInput();
    input.insert("abc");
    input.moveToStart();
    input.deleteWord();
    expect(input.value).toBe("abc");
  });

  test("deleteWord deletes only before the cursor, not after", () => {
    const input = new TextInput();
    input.insert("alpha beta");
    input.cursorPos = 6; // just after "alpha "
    input.deleteWord();
    expect(input.value).toBe("beta");
    expect(input.cursorPos).toBe(0);
  });

  test("moveCursorLeft/Right", () => {
    const input = new TextInput();
    input.insert("hello");
    input.moveCursorLeft();
    expect(input.cursorPos).toBe(4);
    input.moveCursorLeft();
    expect(input.cursorPos).toBe(3);
    input.moveCursorRight();
    expect(input.cursorPos).toBe(4);
  });

  test("moveCursorLeft clamps at 0", () => {
    const input = new TextInput();
    input.moveCursorLeft();
    expect(input.cursorPos).toBe(0);
  });

  test("moveCursorRight clamps at value length", () => {
    const input = new TextInput();
    input.insert("hi");
    input.moveCursorRight();
    expect(input.cursorPos).toBe(2);
  });

  test("moveToStart/moveToEnd", () => {
    const input = new TextInput();
    input.insert("hello");
    input.moveToStart();
    expect(input.cursorPos).toBe(0);
    input.moveToEnd();
    expect(input.cursorPos).toBe(5);
  });

  test("clear resets everything", () => {
    const input = new TextInput();
    input.insert("hello");
    input.clear();
    expect(input.value).toBe("");
    expect(input.cursorPos).toBe(0);
  });

  test("insert in middle of text", () => {
    const input = new TextInput();
    input.insert("hllo");
    input.moveCursorLeft();
    input.moveCursorLeft();
    input.moveCursorLeft();
    input.insert("e");
    expect(input.value).toBe("hello");
    expect(input.cursorPos).toBe(2);
  });

  test("renderWrapped fits short text on one row", () => {
    const input = new TextInput();
    input.insert("abc");
    const buf = CellBuffer.create(10, 5);
    const used = input.renderWrapped(buf, 0, 0, 5, 5, { fg: "#FFFFFF" });
    expect(used).toBe(1);
    expect(buf.getCell(0, 0).char).toBe("a");
    expect(buf.getCell(0, 1).char).toBe("b");
    expect(buf.getCell(0, 2).char).toBe("c");
    expect(buf.getCell(0, 3).bg).toBe("#FFFFFF"); // cursor at end
  });

  test("renderWrapped wraps overflow onto next row", () => {
    const input = new TextInput();
    input.insert("abcdefgh"); // 8 chars
    const buf = CellBuffer.create(10, 5);
    const used = input.renderWrapped(buf, 0, 0, 5, 5, { fg: "#FFFFFF" });
    expect(used).toBe(2);
    expect(buf.getCell(0, 0).char).toBe("a");
    expect(buf.getCell(0, 4).char).toBe("e");
    expect(buf.getCell(1, 0).char).toBe("f");
    expect(buf.getCell(1, 1).char).toBe("g");
    expect(buf.getCell(1, 2).char).toBe("h");
    expect(buf.getCell(1, 3).bg).toBe("#FFFFFF"); // cursor after 'h'
  });

  test("renderWrapped: cursor at end of full line wraps to next row", () => {
    const input = new TextInput();
    input.insert("abcde"); // exactly width
    const buf = CellBuffer.create(10, 5);
    const used = input.renderWrapped(buf, 0, 0, 5, 5, { fg: "#FFFFFF" });
    expect(used).toBe(2);
    expect(buf.getCell(0, 0).char).toBe("a");
    expect(buf.getCell(0, 4).char).toBe("e");
    expect(buf.getCell(1, 0).bg).toBe("#FFFFFF"); // cursor wrapped to row 1 col 0
  });

  test("renderWrapped: empty input shows 1 row with cursor", () => {
    const input = new TextInput();
    const buf = CellBuffer.create(10, 5);
    const used = input.renderWrapped(buf, 0, 0, 5, 5, { fg: "#FFFFFF" });
    expect(used).toBe(1);
    expect(buf.getCell(0, 0).bg).toBe("#FFFFFF");
  });

  test("wrappedHeight matches renderWrapped output", () => {
    const cases = ["", "abc", "abcde", "abcdef", "abcdefghijk"];
    for (const v of cases) {
      const input = new TextInput();
      input.insert(v);
      const buf = CellBuffer.create(10, 10);
      const used = input.renderWrapped(buf, 0, 0, 5, 10);
      expect(input.wrappedHeight(5)).toBe(used);
    }
  });

  test("render writes to buffer with cursor highlight", () => {
    const input = new TextInput();
    input.insert("ab");
    const buf = CellBuffer.create(10, 1);
    input.render(buf, 0, 0, 5, { fg: "#FFFFFF" });

    // Cursor is at position 2 (after 'b')
    const cell0 = buf.getCell(0, 0);
    expect(cell0.char).toBe("a");
    expect(cell0.fg).toBe("#FFFFFF");

    const cell2 = buf.getCell(0, 2);
    // Cursor cell has inverted colors
    expect(cell2.bg).toBe("#FFFFFF");
  });

  test("render scrolls horizontally to keep the cursor visible past the width", () => {
    // Regression: render started from the head, so typing past the field width
    // froze on the opening text with the cursor off screen. It now scrolls to
    // show the tail up to the cursor.
    const input = new TextInput();
    input.value = "abcdefghij"; // 10 chars into a width-5 field
    input.moveToEnd(); // cursor at position 10
    const buf = CellBuffer.create(10, 1);
    input.render(buf, 0, 0, 5, { fg: "#FFFFFF" });
    // The window scrolled to the tail — the head 'a' is gone, g…j show…
    expect(buf.getCell(0, 0).char).not.toBe("a");
    expect(buf.getCell(0, 0).char).toBe("g");
    expect(buf.getCell(0, 3).char).toBe("j");
    // …and the cursor block sits on screen at the right edge (was off screen).
    expect(buf.getCell(0, 4).bg).toBe("#FFFFFF");
  });

  test("the cursor stays on screen at every position in an overflowing field", () => {
    // The window must follow the cursor wherever it goes — never leaving it off
    // screen — and reset to the head when the cursor returns there (not stay
    // stuck scrolled). Guards the whole window-tracking invariant, not just the
    // type-at-the-end case.
    const input = new TextInput();
    input.value = "0123456789abcdef"; // 16 chars into a width-8 field
    const W = 8;
    for (const pos of [0, 4, 8, 12, 16]) {
      input.cursorPos = pos;
      const buf = CellBuffer.create(W, 1);
      input.render(buf, 0, 0, W, { fg: "#FFFFFF" });
      let cursorCol = -1;
      for (let c = 0; c < W; c++) if (buf.getCell(0, c).bg === "#FFFFFF") cursorCol = c;
      expect(cursorCol).toBeGreaterThanOrEqual(0); // cursor block is on screen…
      expect(cursorCol).toBeLessThan(W); // …within the field.
    }
    // Home returns the view to the head — the scroll is not stuck at the tail.
    input.moveToStart();
    const buf = CellBuffer.create(W, 1);
    input.render(buf, 0, 0, W, { fg: "#FFFFFF" });
    expect(buf.getCell(0, 0).char).toBe("0");
  });

  test("cursor colors fall back to theme tokens when style omits fg/bg", () => {
    const { getTheme } = require("../color/theme.ts");
    const t = getTheme();

    const input = new TextInput();
    const buf = CellBuffer.create(10, 1);
    input.render(buf, 0, 0, 5);
    // Empty input: cursor block sits at col 0
    const cursor = buf.getCell(0, 0);
    expect(cursor.bg).toBe(t.primary);
    expect(cursor.fg).toBe(t.bg);

    const wrapped = CellBuffer.create(10, 2);
    input.renderWrapped(wrapped, 0, 0, 5, 2);
    const wCursor = wrapped.getCell(0, 0);
    expect(wCursor.bg).toBe(t.primary);
    expect(wCursor.fg).toBe(t.bg);
  });
});
