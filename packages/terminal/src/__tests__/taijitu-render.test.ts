import { describe, test, expect } from "bun:test";
import { renderTaijitu } from "../scenes/home/taijitu-render.ts";
import { CellBuffer } from "../render/buffer.ts";
import { getTheme } from "../color/theme.ts";

function countCells(buf: CellBuffer, predicate: (fg: string | undefined, char: string) => boolean): number {
  let n = 0;
  for (let r = 0; r < buf.height; r++) {
    for (let c = 0; c < buf.width; c++) {
      const cell = buf.getCell(r, c);
      if (cell.char !== " " && predicate(cell.fg, cell.char)) n++;
    }
  }
  return n;
}

describe("renderTaijitu", () => {
  test("cells use the theme secondary tone by default", () => {
    const buf = new CellBuffer(40, 20);
    renderTaijitu(buf, 20, 10, 8, 0, "dense");
    const themed = countCells(buf, (fg) => fg === getTheme().secondary);
    const unthemed = countCells(buf, (fg) => fg !== getTheme().secondary);
    expect(themed).toBeGreaterThan(0);
    expect(unthemed).toBe(0);
  });

  test("explicit fg override is respected", () => {
    const buf = new CellBuffer(40, 20);
    renderTaijitu(buf, 20, 10, 8, 0, "dots", "#123456");
    expect(countCells(buf, (fg) => fg === "#123456")).toBeGreaterThan(0);
  });

  test("radius below 4 renders nothing", () => {
    const buf = new CellBuffer(40, 20);
    renderTaijitu(buf, 20, 10, 3, 0, "dense");
    expect(countCells(buf, () => true)).toBe(0);
  });
});
