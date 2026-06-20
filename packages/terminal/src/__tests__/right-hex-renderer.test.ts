import { describe, test, expect } from "bun:test";
import { changingCast } from "../testing.ts";
import { renderRightHexagram, renderRightMorph } from "../scenes/cast/right-hex-renderer.ts";
import { CastModel } from "../scenes/cast/model.ts";
import { CellBuffer } from "../render/buffer.ts";

function bufHasContentAtRow(buf: CellBuffer, row: number): boolean {
  for (let c = 0; c < buf.width; c++) {
    if (buf.getCell(row, c).char !== " ") return true;
  }
  return false;
}

describe("right-hex-renderer", () => {
  describe("renderRightHexagram", () => {
    test("does not render when layout is centered", () => {
      const cast = changingCast();
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
      const cast = changingCast();
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
      const cast = changingCast();
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
      const cast = changingCast();
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
      const cast = changingCast();
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
      const cast = changingCast();
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
      const cast = changingCast();
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
