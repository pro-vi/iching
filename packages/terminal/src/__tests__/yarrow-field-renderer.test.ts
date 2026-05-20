import { describe, test, expect } from "bun:test";
import { castYarrowHexagram, SeededRandomSource } from "@iching/core";
import { CellBuffer } from "../render/buffer.ts";
import { YarrowModel } from "../scenes/yarrow/model.ts";
import {
  brailleCell,
  brailleStrand,
  renderYarrowField,
} from "../scenes/yarrow/field-renderer.ts";

function model(seed = 1): YarrowModel {
  return new YarrowModel(castYarrowHexagram(new SeededRandomSource(seed)));
}

function rowHasContent(buf: CellBuffer, row: number): boolean {
  for (let c = 0; c < buf.width; c++) {
    const ch = buf.getCell(row, c).char;
    if (ch && ch !== " ") return true;
  }
  return false;
}

describe("braille primitives", () => {
  test("brailleCell fills in fill order", () => {
    expect(brailleCell(0)).toBe("⠀"); // blank
    expect(brailleCell(8)).toBe("⣿"); // full
    expect(brailleCell(99)).toBe("⣿"); // clamped
  });

  test("brailleStrand packs 8 dots per cell", () => {
    expect(brailleStrand(0)).toBe("");
    expect(brailleStrand(8)).toBe("⣿");
    expect(brailleStrand(49)).toHaveLength(7); // 6 full + 1 partial
    expect(brailleStrand(48)).toHaveLength(6);
  });
});

describe("renderYarrowField", () => {
  test("gather beat draws the field strand", () => {
    const m = model();
    m.beat = "gather";
    m.fieldCount = 49;
    const buf = new CellBuffer(80, 24);
    renderYarrowField(buf, m);
    expect(rowHasContent(buf, 20)).toBe(true); // field row (anchorRow(24)+5)
  });

  test("divide, count, and tally beats all render without overflow", () => {
    for (const beat of ["divide", "count", "tally"] as const) {
      const m = model(beat.length); // vary the seed a little
      m.activeLine = 0;
      m.activeRound = 0;
      m.beat = beat;
      m.splitProgress = 1;
      m.countProgress = 0.5;
      m.tallyProgress = 1;
      const buf = new CellBuffer(80, 24);
      expect(() => renderYarrowField(buf, m)).not.toThrow();
      expect(rowHasContent(buf, 20)).toBe(true);
    }
  });

  test("a cast line draws into the hexagram band", () => {
    const m = model();
    m.lines[0].progress = 1;
    const buf = new CellBuffer(80, 24);
    renderYarrowField(buf, m);
    // anchorRow(24) + LINE_ROW_OFFSETS[0] = 15 + (-1) = 14
    expect(rowHasContent(buf, 14)).toBe(true);
  });

  test("narrow terminal falls back without overflow", () => {
    const m = model();
    m.beat = "gather";
    const buf = new CellBuffer(24, 24);
    expect(() => renderYarrowField(buf, m)).not.toThrow();
  });

  test("fuse beat leaves the field area empty", () => {
    const m = model();
    m.activeLine = 0;
    m.beat = "fuse";
    const buf = new CellBuffer(80, 24);
    renderYarrowField(buf, m);
    expect(rowHasContent(buf, 20)).toBe(false);
  });
});
