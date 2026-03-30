import { describe, test, expect } from "bun:test";
import { renderRightHexagram, renderRightMorph } from "../scenes/cast/right-hex-renderer.ts";
import { CastModel } from "../scenes/cast/model.ts";
import { CellBuffer } from "../render/buffer.ts";
import type { Cast } from "@iching/core";

function makeChangingCast(): Cast {
  return {
    lines: [
      { value: 9, isYang: true, isChanging: true },   // line 1: old yang -> yin
      { value: 8, isYang: false, isChanging: false },  // line 2: young yin
      { value: 7, isYang: true, isChanging: false },   // line 3: young yang
      { value: 6, isYang: false, isChanging: true },   // line 4: old yin -> yang
      { value: 7, isYang: true, isChanging: false },   // line 5: young yang
      { value: 8, isYang: false, isChanging: false },  // line 6: young yin
    ],
    primary: 21,
    becoming: 42,
    changingPositions: [1, 4],
    nuclear: 39,
    polarity: 48,
    mirror: 22,
    diagonal: 47,
  };
}

function bufHasContentAtRow(buf: CellBuffer, row: number): boolean {
  for (let c = 0; c < buf.width; c++) {
    if (buf.getCell(row, c).char !== " ") return true;
  }
  return false;
}

describe("right-hex-renderer", () => {
  describe("renderRightHexagram", () => {
    test("does not render when layout is centered", () => {
      const cast = makeChangingCast();
      const model = new CastModel(cast);
      model.layout = "centered";
      model.splitProgress = 0;

      const buf = CellBuffer.create(80, 24);
      renderRightHexagram(buf, model, 10);

      // Buffer should be empty
      let hasContent = false;
      for (let r = 0; r < buf.height; r++) {
        if (bufHasContentAtRow(buf, r)) {
          hasContent = true;
          break;
        }
      }
      expect(hasContent).toBe(false);
    });

    test("renders non-changing lines at offset when split", () => {
      const cast = makeChangingCast();
      const model = new CastModel(cast);
      model.layout = "side-by-side";
      model.splitProgress = 1;
      // Mark all lines as settled (progress=1)
      for (const ls of model.lines) {
        ls.progress = 1;
        ls.settled = true;
      }

      const buf = CellBuffer.create(80, 24);
      renderRightHexagram(buf, model, 10);

      // Should have rendered content (non-changing lines at least)
      let hasContent = false;
      for (let r = 0; r < buf.height; r++) {
        if (bufHasContentAtRow(buf, r)) {
          hasContent = true;
          break;
        }
      }
      expect(hasContent).toBe(true);
    });

    test("skips changing lines with active morph", () => {
      const cast = makeChangingCast();
      const model = new CastModel(cast);
      model.layout = "side-by-side";
      model.splitProgress = 1;
      for (const ls of model.lines) {
        ls.progress = 1;
        ls.settled = true;
      }
      // Set morph in progress for first changing line
      model.rightHexMorphProgress[0] = 0.5;
      model.rightHexMorphComplete = false;

      // Render and verify right morph renders instead
      const buf = CellBuffer.create(80, 24);
      renderRightHexagram(buf, model, 10);
      // The non-changing lines should still render
      let hasContent = false;
      for (let r = 0; r < buf.height; r++) {
        if (bufHasContentAtRow(buf, r)) {
          hasContent = true;
          break;
        }
      }
      expect(hasContent).toBe(true);
    });

    test("renders transformed lines when morph is complete", () => {
      const cast = makeChangingCast();
      const model = new CastModel(cast);
      model.layout = "side-by-side";
      model.splitProgress = 1;
      for (const ls of model.lines) {
        ls.progress = 1;
        ls.settled = true;
      }
      model.rightHexMorphProgress = [1, 1];
      model.rightHexMorphComplete = true;

      const buf = CellBuffer.create(80, 24);
      renderRightHexagram(buf, model, 10);

      // All 6 lines should render (non-changing same, changing transformed)
      let contentRows = 0;
      for (let r = 0; r < buf.height; r++) {
        if (bufHasContentAtRow(buf, r)) contentRows++;
      }
      expect(contentRows).toBe(6); // 6 hexagram lines
    });
  });

  describe("renderRightMorph", () => {
    test("does not render when layout is centered", () => {
      const cast = makeChangingCast();
      const model = new CastModel(cast);
      model.layout = "centered";
      model.rightHexMorphProgress[0] = 0.5;

      const buf = CellBuffer.create(80, 24);
      renderRightMorph(buf, model, 10);

      let hasContent = false;
      for (let r = 0; r < buf.height; r++) {
        if (bufHasContentAtRow(buf, r)) {
          hasContent = true;
          break;
        }
      }
      expect(hasContent).toBe(false);
    });

    test("renders morphing lines when split and morph in progress", () => {
      const cast = makeChangingCast();
      const model = new CastModel(cast);
      model.layout = "side-by-side";
      model.splitProgress = 1;
      model.rightHexMorphProgress[0] = 0.5; // first changing line morphing
      model.rightHexMorphComplete = false;

      const buf = CellBuffer.create(80, 24);
      renderRightMorph(buf, model, 10);

      // Should have content for the morphing line
      let hasContent = false;
      for (let r = 0; r < buf.height; r++) {
        if (bufHasContentAtRow(buf, r)) {
          hasContent = true;
          break;
        }
      }
      expect(hasContent).toBe(true);
    });

    test("does not render when morph is complete", () => {
      const cast = makeChangingCast();
      const model = new CastModel(cast);
      model.layout = "side-by-side";
      model.splitProgress = 1;
      model.rightHexMorphProgress = [1, 1];
      model.rightHexMorphComplete = true;

      const buf = CellBuffer.create(80, 24);
      renderRightMorph(buf, model, 10);

      let hasContent = false;
      for (let r = 0; r < buf.height; r++) {
        if (bufHasContentAtRow(buf, r)) {
          hasContent = true;
          break;
        }
      }
      expect(hasContent).toBe(false);
    });
  });
});
