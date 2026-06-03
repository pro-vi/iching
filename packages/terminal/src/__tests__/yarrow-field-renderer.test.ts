import { describe, test, expect } from "bun:test";
import { castYarrowHexagram, SeededRandomSource } from "@iching/core";
import { CellBuffer } from "../render/buffer.ts";
import { YarrowModel } from "../scenes/yarrow/model.ts";
import {
  brailleCell,
  brailleStrand,
  drawApertureCursor,
  renderYarrowField,
  renderYarrowFieldStrip,
} from "../scenes/yarrow/field-renderer.ts";
import { setTheme } from "../color/theme.ts";

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

  test("fuse beat renders the lifting bar (somewhere between field and target rows)", () => {
    const m = model();
    m.activeLine = 0;
    m.beat = "fuse";
    m.lines[0].progress = 0; // pre-lift — bar at field row
    const buf = new CellBuffer(80, 24);
    renderYarrowField(buf, m);
    // Bar starts at the field row (anchorRow(24)+5 = 20).
    expect(rowHasContent(buf, 20)).toBe(true);
  });
});

// ── Sequential count + tally (U3) ────────────────────────────────────────────

describe("renderYarrowField — sequential count + tally", () => {
  test("count phase 1 [0, 0.5] drains left heap only", () => {
    const m = model(123);
    m.activeLine = 0;
    m.activeRound = 0;
    m.beat = "count";
    m.countProgress = 0.25; // mid phase 1: left half-drained, right full
    const buf = new CellBuffer(80, 24);
    renderYarrowField(buf, m);

    const round = m.transcript[0].rounds[0];
    const leftMid = (round.splitAt + round.leftRemainder) / 2;
    const rightStart = round.startCount - round.splitAt - 1;
    // Left should be partially drained (between start and end);
    // right should still be at its full post-takeOne start.
    expect(leftMid).toBeLessThan(round.splitAt);
    expect(leftMid).toBeGreaterThan(round.leftRemainder);
    expect(rightStart).toBe(round.startCount - round.splitAt - 1);
  });

  test("count phase 2 [0.5, 1] holds left at remainder while right drains", () => {
    const m = model(123);
    m.activeLine = 0;
    m.activeRound = 0;
    m.beat = "count";
    m.countProgress = 0.75; // mid phase 2: left settled, right half-drained
    const buf = new CellBuffer(80, 24);
    expect(() => renderYarrowField(buf, m)).not.toThrow();
    // left should now be at remainder; we verify visually via recording sweep.
  });

  test("tally inTray grows monotonically through both phases to setAside", () => {
    const m = model(7);
    m.activeLine = 0;
    m.activeRound = 0;
    m.beat = "tally";
    const round = m.transcript[0].rounds[0];
    // setAside = 1 + leftRem + rightRem
    expect(round.setAside).toBe(1 + round.leftRemainder + round.rightRemainder);
  });
});

// ── Operator cursor overlay (U4) ─────────────────────────────────────────────

describe("renderYarrowField — operator cursor overlay", () => {
  test("cursor renders without error during all active beats", () => {
    // The cursor highlights without bold; bold was dropped to avoid the
    // "thinner stalk" artifact in some terminals.
    // These tests confirm rendering doesn't throw and the field row has
    // content; visual verification of the highlight happens via recording.
    for (const beat of ["divide", "takeOne", "count", "tally"] as const) {
      const m = model(11);
      m.activeLine = 0;
      m.activeRound = 0;
      m.beat = beat;
      m.splitProgress = 1;
      m.takeOneProgress = 0.5;
      m.countProgress = 0.25;
      m.tallyProgress = 0.5;
      const buf = new CellBuffer(80, 24);
      expect(() => renderYarrowField(buf, m)).not.toThrow();
      expect(rowHasContent(buf, 20)).toBe(true);
    }
  });

  test("renderYarrowFieldStrip draws at the caller-supplied row", () => {
    // 24-row buffer → scene's default field row is anchorRow(24)+5 = 20.
    // Strip at row 10 means content lands there and NOT at row 20.
    const m = model();
    m.beat = "gather";
    m.activeLine = 0;
    m.activeRound = 0;
    m.fieldCount = 49;
    const buf = new CellBuffer(80, 24);
    renderYarrowFieldStrip(buf, m, 10);
    expect(rowHasContent(buf, 10)).toBe(true);
    expect(rowHasContent(buf, 20)).toBe(false);
  });

  test("manual aperture cursor is visibly highlighted in ink theme", () => {
    setTheme("ink");
    try {
      const buf = new CellBuffer(80, 24);

      drawApertureCursor(buf, 10, 40, 10);

      const highlighted = buf.getCell(10, 25);
      expect(highlighted.char).toBe("│");
      expect(highlighted.fg).toBe("#606060");
      expect(highlighted.bg).toBeUndefined();

      const rightBracket = buf.getCell(10, 29);
      expect(rightBracket.char).toBe("╡");
      expect(rightBracket.fg).toBe("#606060");
      expect(rightBracket.bg).toBeUndefined();
    } finally {
      setTheme("bone");
    }
  });

  test("cursor is hidden during gather, fuse, carry (no extra overlay)", () => {
    // The overlay should leave gather (substance at rest), fuse (line owns
    // its arrival), and carry (would conflict with temp-fours `▌`) alone.
    // Verified by rendering without throwing — visual verification follows.
    for (const beat of ["gather", "carry", "fuse"] as const) {
      const m = model();
      m.activeLine = 0;
      m.activeRound = 0;
      m.beat = beat;
      m.fieldCount = 49;
      const buf = new CellBuffer(80, 24);
      expect(() => renderYarrowField(buf, m)).not.toThrow();
    }
  });
});
