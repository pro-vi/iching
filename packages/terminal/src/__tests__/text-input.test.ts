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
});
