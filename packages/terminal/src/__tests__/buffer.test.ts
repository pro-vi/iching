import { describe, test, expect } from "bun:test";
import { CellBuffer } from "../render/buffer.ts";
import { EMPTY_CELL, type StyledCell } from "../render/cell.ts";

describe("CellBuffer", () => {
  test("create buffer with correct dimensions", () => {
    const buf = CellBuffer.create(10, 5);
    expect(buf.width).toBe(10);
    expect(buf.height).toBe(5);
  });

  test("setCell/getCell round-trip", () => {
    const buf = CellBuffer.create(10, 5);
    const cell: StyledCell = { char: "X", fg: "#C89D4B", bold: true };
    buf.setCell(2, 3, cell);
    const got = buf.getCell(2, 3);
    expect(got.char).toBe("X");
    expect(got.fg).toBe("#C89D4B");
    expect(got.bold).toBe(true);
  });

  test("getCell returns EMPTY_CELL-like for unset positions", () => {
    const buf = CellBuffer.create(10, 5);
    const cell = buf.getCell(0, 0);
    expect(cell.char).toBe(" ");
    expect(cell.fg).toBeUndefined();
  });

  test("writeText places characters with style", () => {
    const buf = CellBuffer.create(20, 5);
    buf.writeText(1, 2, "hello", { fg: "#E8DECE" });
    expect(buf.getCell(1, 2).char).toBe("h");
    expect(buf.getCell(1, 2).fg).toBe("#E8DECE");
    expect(buf.getCell(1, 3).char).toBe("e");
    expect(buf.getCell(1, 4).char).toBe("l");
    expect(buf.getCell(1, 5).char).toBe("l");
    expect(buf.getCell(1, 6).char).toBe("o");
  });

  test("clear resets all cells", () => {
    const buf = CellBuffer.create(10, 5);
    buf.setCell(0, 0, { char: "A", fg: "#FF0000" });
    buf.setCell(4, 9, { char: "Z", bold: true });
    buf.clear();
    expect(buf.getCell(0, 0).char).toBe(" ");
    expect(buf.getCell(0, 0).fg).toBeUndefined();
    expect(buf.getCell(4, 9).char).toBe(" ");
    expect(buf.getCell(4, 9).bold).toBeUndefined();
  });

  test("out-of-bounds setCell is a no-op", () => {
    const buf = CellBuffer.create(10, 5);
    // These should not throw
    buf.setCell(-1, 0, { char: "X" });
    buf.setCell(0, -1, { char: "X" });
    buf.setCell(5, 0, { char: "X" });
    buf.setCell(0, 10, { char: "X" });
    // Buffer should still be empty
    expect(buf.getCell(0, 0).char).toBe(" ");
  });

  test("out-of-bounds getCell returns EMPTY_CELL", () => {
    const buf = CellBuffer.create(10, 5);
    expect(buf.getCell(-1, 0).char).toBe(" ");
    expect(buf.getCell(0, -1).char).toBe(" ");
    expect(buf.getCell(100, 0).char).toBe(" ");
  });

  test("writeText truncates at buffer width", () => {
    const buf = CellBuffer.create(5, 1);
    buf.writeText(0, 3, "abcde");
    expect(buf.getCell(0, 3).char).toBe("a");
    expect(buf.getCell(0, 4).char).toBe("b");
    // c, d, e should not appear — they're outside the buffer
  });

  test("writeText handles CJK wide characters", () => {
    const buf = CellBuffer.create(20, 1);
    buf.writeText(0, 0, "\u4e16\u754c", { fg: "#C89D4B" }); // 世界 — two CJK chars, each width 2
    expect(buf.getCell(0, 0).char).toBe("\u4e16");
    expect(buf.getCell(0, 0).fg).toBe("#C89D4B");
    // Column 1 is a continuation cell for the wide char
    expect(buf.getCell(0, 1).char).toBe("");
    expect(buf.getCell(0, 2).char).toBe("\u754c");
    expect(buf.getCell(0, 3).char).toBe("");
  });
});
