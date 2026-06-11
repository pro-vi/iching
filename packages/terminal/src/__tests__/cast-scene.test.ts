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
    expect(result).toEqual({ type: "home" });
  });

  test("handleKey(enter) after prompt shown enters exploration mode", () => {
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
    expect(result).toBeUndefined();
    expect(scene.getModel().explorationMode).toBe(true);
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
    expect(result).toEqual({ type: "openJournal" });
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
    expect(result).toEqual({ type: "exit" });
  });

  test("all presets create valid scenes", () => {
    const cast = makeCast();
    for (const preset of ["default", "brisk", "deep", "reduced"] as const) {
      const scene = new CastScene(cast, preset);
      expect(scene).toBeDefined();
      expect(scene.getTimeline().duration).toBeGreaterThan(0);
    }
  });

  test("side-by-side activates for wide terminal with becoming", () => {
    const cast = makeChangingCast();
    const scene = new CastScene(cast, "reduced", 80); // wide terminal
    const ctx = makeCtx();

    scene.enter(ctx);

    // Advance to completion
    const duration = scene.getTimeline().duration;
    scene.update(duration + 100, 33, ctx);

    const model = scene.getModel();
    // Wide terminal should use side-by-side layout
    expect(model.layout).toBe("side-by-side");
    expect(model.splitProgress).toBe(1);
    expect(model.rightHexMorphComplete).toBe(true);
    expect(model.becomingTitleProgress).toBe(1);
  });

  test("narrow terminal falls back to in-place morph", () => {
    const cast = makeChangingCast();
    const scene = new CastScene(cast, "reduced", 40); // narrow terminal
    const ctx = makeCtx();

    scene.enter(ctx);

    // Advance to completion
    const duration = scene.getTimeline().duration;
    scene.update(duration + 100, 33, ctx);

    const model = scene.getModel();
    // Narrow terminal should stay centered with in-place morph
    expect(model.layout).toBe("centered");
    expect(model.splitProgress).toBe(0);
    // In-place morph should have completed on the primary lines
    for (const pos of cast.changingPositions) {
      expect(model.lines[pos - 1].morphComplete).toBe(true);
    }
  });

  test("side-by-side renders without errors on wide buffer", () => {
    const cast = makeChangingCast();
    const scene = new CastScene(cast, "reduced", 80);
    const ctx = makeCtx();

    scene.enter(ctx);

    // Advance to completion
    const duration = scene.getTimeline().duration;
    scene.update(duration + 100, 33, ctx);

    const frame = CellBuffer.create(80, 24);
    // Should not throw
    scene.render(frame, ctx);

    // Check that buffer has content
    let hasContent = false;
    for (let r = 0; r < frame.height; r++) {
      for (let c = 0; c < frame.width; c++) {
        if (frame.getCell(r, c).char !== " ") {
          hasContent = true;
          break;
        }
      }
      if (hasContent) break;
    }
    expect(hasContent).toBe(true);
  });
});

/** Collect the visible text of a rendered frame as one string per row. */
function frameText(scene: CastScene, ctx: SceneContext): string[] {
  const frame = CellBuffer.create(ctx.cols, ctx.rows);
  scene.render(frame, ctx);
  const rows: string[] = [];
  for (let r = 0; r < frame.height; r++) {
    let row = "";
    for (let c = 0; c < frame.width; c++) row += frame.getCell(r, c).char;
    rows.push(row.trimEnd());
  }
  return rows;
}

describe("CastScene escape key", () => {
  test("escape returns home during animation", () => {
    const scene = new CastScene(makeCast(), "reduced");
    const result = scene.handleKey({ type: "escape" }, makeCtx());
    expect(result).toEqual({ type: "home" });
  });

  test("escape returns home in exploration mode (footer advertises it)", () => {
    const scene = new CastScene(makeChangingCast(), "reduced", 80);
    const ctx = makeCtx();
    scene.enter(ctx);
    scene.update(scene.getTimeline().duration + 100, 33, ctx);
    expect(scene.getModel().explorationMode).toBe(true);

    const result = scene.handleKey({ type: "escape" }, ctx);
    expect(result).toEqual({ type: "home" });
  });
});

describe("CastScene pace control", () => {
  test("space toggles pause during the reveal", () => {
    const scene = new CastScene(makeCast(), "reduced");
    const ctx = makeCtx();
    scene.enter(ctx);
    scene.update(100, 33, ctx);

    scene.handleKey({ type: "char", char: " " }, ctx);
    expect(scene.getModel().paused).toBe(true);

    // While paused, the timeline does not advance
    const before = scene.getModel().titleProgress;
    scene.update(scene.getTimeline().duration + 5000, 33, ctx);
    expect(scene.getModel().showPrompt).toBe(false);
    expect(scene.getModel().titleProgress).toBe(before);

    scene.handleKey({ type: "char", char: " " }, ctx);
    expect(scene.getModel().paused).toBe(false);
  });

  test("s skips to the fully revealed state", () => {
    const scene = new CastScene(makeChangingCast(), "reduced", 80);
    const ctx = makeCtx();
    scene.enter(ctx);
    scene.update(100, 33, ctx);

    scene.handleKey({ type: "char", char: "s" }, ctx);
    const model = scene.getModel();
    expect(model.showPrompt).toBe(true);
    expect(model.explorationMode).toBe(true);
    expect(model.layout).toBe("side-by-side");
  });

  test("f cycles speed 1 → 2 → 4 → 1", () => {
    const scene = new CastScene(makeCast(), "reduced");
    const ctx = makeCtx();
    scene.enter(ctx);
    scene.update(100, 33, ctx);

    scene.handleKey({ type: "char", char: "f" }, ctx);
    expect(scene.getModel().speed).toBe(2);
    scene.handleKey({ type: "char", char: "f" }, ctx);
    expect(scene.getModel().speed).toBe(4);
    scene.handleKey({ type: "char", char: "f" }, ctx);
    expect(scene.getModel().speed).toBe(1);
  });

  test("pace keys are inert once the prompt is shown", () => {
    const scene = new CastScene(makeCast(), "reduced");
    const ctx = makeCtx();
    scene.enter(ctx);
    scene.update(scene.getTimeline().duration + 100, 33, ctx);
    expect(scene.getModel().showPrompt).toBe(true);

    scene.handleKey({ type: "char", char: " " }, ctx);
    expect(scene.getModel().paused).toBe(false);
    scene.handleKey({ type: "char", char: "f" }, ctx);
    expect(scene.getModel().speed).toBe(1);
  });

  test("pace footer is shown during the reveal", () => {
    const scene = new CastScene(makeCast(), "reduced");
    const ctx = makeCtx();
    scene.enter(ctx);
    scene.update(100, 33, ctx);

    const rows = frameText(scene, ctx);
    expect(rows[ctx.rows - 2]).toContain("[space] pause");
    expect(rows[ctx.rows - 2]).toContain("[esc] back");
  });
});

describe("CastScene reading panel", () => {
  test("changing lines' texts appear after the reveal", () => {
    const scene = new CastScene(makeChangingCast(), "reduced", 80);
    const ctx = makeCtx();
    scene.enter(ctx);
    scene.update(scene.getTimeline().duration + 100, 33, ctx);

    const text = frameText(scene, ctx).join("\n");
    // Hexagram 21, changing lines 1 and 4 — the hint plus line 1's text
    expect(text).toContain("two lines move — the upper governs");
    expect(text).toContain("1 · His feet are fastened");
  });

  test("judgment shown when no lines move", () => {
    const scene = new CastScene(makeCast(), "reduced");
    const ctx = makeCtx();
    scene.enter(ctx);
    scene.update(scene.getTimeline().duration + 100, 33, ctx);

    const text = frameText(scene, ctx).join("\n");
    // Hexagram 63 既濟 — the judgment is the reading
    expect(text).toContain("Judgment · ");
  });

  test("no reading panel before the reveal settles", () => {
    const scene = new CastScene(makeChangingCast(), "reduced", 80);
    const ctx = makeCtx();
    scene.enter(ctx);
    scene.update(100, 33, ctx);

    const text = frameText(scene, ctx).join("\n");
    expect(text).not.toContain("two lines move");
  });
});

describe("CastScene openDetail cast context", () => {
  test("primary detail carries the changing positions", () => {
    const scene = new CastScene(makeChangingCast(), "reduced", 80);
    const ctx = makeCtx();
    scene.enter(ctx);
    scene.update(scene.getTimeline().duration + 100, 33, ctx);

    const model = scene.getModel();
    model.focusedHex = "primary";
    const result = scene.handleKey({ type: "enter" }, ctx);
    expect(result).toEqual({ type: "openDetail", kw: 21, changedPositions: [1, 4] });
  });

  test("becoming detail opens without cast context", () => {
    const scene = new CastScene(makeChangingCast(), "reduced", 80);
    const ctx = makeCtx();
    scene.enter(ctx);
    scene.update(scene.getTimeline().duration + 100, 33, ctx);

    scene.getModel().focusedHex = "becoming";
    const result = scene.handleKey({ type: "enter" }, ctx);
    expect(result).toEqual({ type: "openDetail", kw: 42 });
  });

  test("unchanging cast opens primary detail without context", () => {
    const scene = new CastScene(makeCast(), "reduced");
    const ctx = makeCtx();
    scene.enter(ctx);
    scene.update(scene.getTimeline().duration + 100, 33, ctx);
    scene.handleKey({ type: "enter" }, ctx); // enter exploration
    const result = scene.handleKey({ type: "enter" }, ctx);
    expect(result).toEqual({ type: "openDetail", kw: 63 });
  });
});
