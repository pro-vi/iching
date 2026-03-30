import { describe, test, expect } from "bun:test";
import { CastScene } from "../scenes/cast/cast-scene.ts";
import { CellBuffer } from "../render/buffer.ts";
import type { SceneContext } from "../scene/types.ts";
import type { Cast } from "@iching/core";

/** Build a Cast with all young lines (no changing) */
function makeCast(overrides?: Partial<Cast>): Cast {
  return {
    lines: [
      { value: 7, isYang: true, isChanging: false },
      { value: 8, isYang: false, isChanging: false },
      { value: 7, isYang: true, isChanging: false },
      { value: 8, isYang: false, isChanging: false },
      { value: 7, isYang: true, isChanging: false },
      { value: 8, isYang: false, isChanging: false },
    ],
    primary: 63, // After Completion
    becoming: null,
    changingPositions: [],
    nuclear: 64,
    polarity: 64,
    mirror: 64,
    diagonal: 63,
    ...overrides,
  };
}

/** Cast with changing lines (becoming) */
function makeChangingCast(): Cast {
  return {
    lines: [
      { value: 9, isYang: true, isChanging: true },
      { value: 8, isYang: false, isChanging: false },
      { value: 7, isYang: true, isChanging: false },
      { value: 6, isYang: false, isChanging: true },
      { value: 7, isYang: true, isChanging: false },
      { value: 8, isYang: false, isChanging: false },
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

function makeCtx(): SceneContext {
  return { cols: 80, rows: 24, done: false, colorSupport: "truecolor" };
}

describe("CastScene", () => {
  test("creates from Cast data without error", () => {
    const cast = makeCast();
    const scene = new CastScene(cast);
    expect(scene).toBeDefined();
  });

  test("creates from Cast with changing lines without error", () => {
    const cast = makeChangingCast();
    const scene = new CastScene(cast);
    expect(scene).toBeDefined();
  });

  test("update/render cycle produces non-empty buffer", () => {
    const cast = makeCast();
    const scene = new CastScene(cast, "reduced");
    const ctx = makeCtx();

    scene.enter(ctx);

    // Advance past the opening breath to get some content
    scene.update(2000, 33, ctx);

    const frame = CellBuffer.create(80, 24);
    scene.render(frame, ctx);

    // Check that at least one cell is non-empty
    let hasContent = false;
    for (let r = 0; r < frame.height; r++) {
      for (let c = 0; c < frame.width; c++) {
        const cell = frame.getCell(r, c);
        if (cell.char !== " ") {
          hasContent = true;
          break;
        }
      }
      if (hasContent) break;
    }
    expect(hasContent).toBe(true);
  });

  test("handleKey('q') returns 'exit'", () => {
    const cast = makeCast();
    const scene = new CastScene(cast);
    const ctx = makeCtx();

    const result = scene.handleKey({ type: "char", char: "q" }, ctx);
    expect(result).toBe("exit");
  });

  test("handleKey(enter) after prompt shown returns goto reading", () => {
    const cast = makeCast();
    const scene = new CastScene(cast, "reduced");
    const ctx = makeCtx();

    scene.enter(ctx);

    // Advance to completion
    const duration = scene.getTimeline().duration;
    scene.update(duration + 100, 33, ctx);

    // Model should have prompt shown
    expect(scene.getModel().showPrompt).toBe(true);

    const result = scene.handleKey({ type: "enter" }, ctx);
    expect(result).toEqual({ goto: "reading" });
  });

  test("handleKey(j) after prompt shown returns goto journal", () => {
    const cast = makeCast();
    const scene = new CastScene(cast, "reduced");
    const ctx = makeCtx();

    scene.enter(ctx);

    const duration = scene.getTimeline().duration;
    scene.update(duration + 100, 33, ctx);

    expect(scene.getModel().showPrompt).toBe(true);

    const result = scene.handleKey({ type: "char", char: "j" }, ctx);
    expect(result).toEqual({ goto: "journal" });
  });

  test("with ManualClock-style advance, reaches completion", () => {
    const cast = makeCast();
    const scene = new CastScene(cast, "reduced");
    const ctx = makeCtx();

    scene.enter(ctx);

    const duration = scene.getTimeline().duration;

    // Step through in increments
    const step = 100;
    for (let elapsed = 0; elapsed <= duration + step; elapsed += step) {
      scene.update(elapsed, step, ctx);
    }

    // After full timeline, prompt should be visible
    expect(scene.getModel().showPrompt).toBe(true);
  });

  test("ctrl-c returns exit", () => {
    const cast = makeCast();
    const scene = new CastScene(cast);
    const ctx = makeCtx();

    const result = scene.handleKey({ type: "ctrl", char: "c" }, ctx);
    expect(result).toBe("exit");
  });

  test("all presets create valid scenes", () => {
    const cast = makeCast();
    for (const preset of ["default", "brisk", "deep", "reduced"] as const) {
      const scene = new CastScene(cast, preset);
      expect(scene).toBeDefined();
      expect(scene.getTimeline().duration).toBeGreaterThan(0);
    }
  });
});
