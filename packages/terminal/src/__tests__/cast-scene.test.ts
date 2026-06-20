import { describe, test, expect } from "bun:test";
import { changingCast, sceneCtx, staticCast } from "../testing.ts";
import { CastScene } from "../scenes/cast/cast-scene.ts";
import { CellBuffer } from "../render/buffer.ts";
import type { SceneContext } from "../scene/types.ts";
import type { Cast } from "@iching/core";

/** Build a Cast with all young lines (no changing) */

/** Cast with changing lines (becoming) */

describe("CastScene", () => {
  test("creates from Cast data without error", () => {
    const cast = staticCast();
    const scene = new CastScene(cast);
    expect(scene).toBeDefined();
  });

  test("creates from Cast with changing lines without error", () => {
    const cast = changingCast();
    const scene = new CastScene(cast);
    expect(scene).toBeDefined();
  });

  test("the virtual clock advances by the CLAMPED dt, not the unclamped elapsed gap", () => {
    // The loop skips update() while the terminal is below the size floor but
    // `elapsed` keeps growing; on restore the scene must credit only the clamped
    // per-frame dt (like the yarrow scene), or it fast-forwards past the reveal —
    // multiplied at 2×/4× pace.
    const scene = new CastScene(staticCast(), "default", 80, undefined, 24);
    const ctx = sceneCtx(80, 24, "truecolor");
    scene.getModel().speed = 4; // [f] fast pace
    scene.update(100_000, 50, ctx); // a huge elapsed jump, but dt clamped to 50
    const s = scene as unknown as { virtualElapsed: number };
    expect(s.virtualElapsed).toBe(200); // 50 × 4 — NOT 100000 (×4 = 400000)
  });

  test("update/render cycle produces non-empty buffer", () => {
    const cast = staticCast();
    const scene = new CastScene(cast, "reduced");
    const ctx = sceneCtx(80, 24, "truecolor");

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

  test("a replayed reading's stored intention renders with control sequences stripped", () => {
    // [enter] on a journal entry replays it as a CastScene carrying the entry's
    // STORED intention. A synced / imported / hand-edited journal can carry
    // escapes the input path never sanitized — they must not reach the frame
    // (and thence the terminal). ESC + BEL woven between visible words.
    const cast = staticCast();
    const evil = "seek]0;pwnedtruth";
    const scene = new CastScene(cast, "reduced", 80, undefined, 24, evil);
    const ctx = sceneCtx(80, 24, "truecolor");
    scene.enter(ctx);
    scene.skipToComplete(false); // reveal the prompt row where the intention shows

    const frame = CellBuffer.create(80, 24);
    scene.render(frame, ctx);

    let rendered = "";
    for (let r = 0; r < frame.height; r++) {
      for (let c = 0; c < frame.width; c++) rendered += frame.getCell(r, c).char;
    }
    expect(rendered).not.toContain(""); // no raw ESC in any cell
    expect(rendered).not.toContain(""); // no raw BEL
    expect(rendered).toContain("seek"); // the words survive
    expect(rendered).toContain("truth");
  });

  test("handleKey('q') returns 'exit'", () => {
    const cast = staticCast();
    const scene = new CastScene(cast);
    const ctx = sceneCtx(80, 24, "truecolor");

    const result = scene.handleKey({ type: "char", char: "q" }, ctx);
    expect(result).toEqual({ type: "home" });
  });

  test("handleKey(enter) after prompt shown enters exploration mode", () => {
    const cast = staticCast();
    const scene = new CastScene(cast, "reduced");
    const ctx = sceneCtx(80, 24, "truecolor");

    scene.enter(ctx);

    // Advance to completion
    scene.skipToComplete(false);

    // Model should have prompt shown
    expect(scene.getModel().showPrompt).toBe(true);

    const result = scene.handleKey({ type: "enter" }, ctx);
    expect(result).toBeUndefined();
    expect(scene.getModel().explorationMode).toBe(true);
  });

  test("handleKey(j) after prompt shown returns goto journal", () => {
    const cast = staticCast();
    const scene = new CastScene(cast, "reduced");
    const ctx = sceneCtx(80, 24, "truecolor");

    scene.enter(ctx);

    scene.skipToComplete(false);

    expect(scene.getModel().showPrompt).toBe(true);

    const result = scene.handleKey({ type: "char", char: "j" }, ctx);
    expect(result).toEqual({ type: "openJournal" });
  });

  test("with ManualClock-style advance, reaches completion", () => {
    const cast = staticCast();
    const scene = new CastScene(cast, "reduced");
    const ctx = sceneCtx(80, 24, "truecolor");

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
    const cast = staticCast();
    const scene = new CastScene(cast);
    const ctx = sceneCtx(80, 24, "truecolor");

    const result = scene.handleKey({ type: "ctrl", char: "c" }, ctx);
    expect(result).toEqual({ type: "exit" });
  });

  test("all presets create valid scenes", () => {
    const cast = staticCast();
    for (const preset of ["default", "brisk", "deep", "reduced"] as const) {
      const scene = new CastScene(cast, preset);
      expect(scene).toBeDefined();
      expect(scene.getTimeline().duration).toBeGreaterThan(0);
    }
  });

  test("side-by-side activates for wide terminal with becoming", () => {
    const cast = changingCast();
    const scene = new CastScene(cast, "reduced", 80); // wide terminal
    const ctx = sceneCtx(80, 24, "truecolor");

    scene.enter(ctx);

    // Advance to completion
    scene.skipToComplete(false);

    const model = scene.getModel();
    // Wide terminal should use side-by-side layout
    expect(model.layout).toBe("side-by-side");
    expect(model.splitProgress).toBe(1);
    expect(model.rightHexMorphComplete).toBe(true);
    expect(model.becomingTitleProgress).toBe(1);
  });

  test("narrow terminal falls back to in-place morph", () => {
    const cast = changingCast();
    const scene = new CastScene(cast, "reduced", 40); // narrow terminal
    const ctx = sceneCtx(80, 24, "truecolor");

    scene.enter(ctx);

    // Advance to completion
    scene.skipToComplete(false);

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
    const cast = changingCast();
    const scene = new CastScene(cast, "reduced", 80);
    const ctx = sceneCtx(80, 24, "truecolor");

    scene.enter(ctx);

    // Advance to completion
    scene.skipToComplete(false);

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
    const scene = new CastScene(staticCast(), "reduced");
    const result = scene.handleKey({ type: "escape" }, sceneCtx(80, 24, "truecolor"));
    expect(result).toEqual({ type: "home" });
  });

  test("escape returns home in exploration mode (footer advertises it)", () => {
    const scene = new CastScene(changingCast(), "reduced", 80);
    const ctx = sceneCtx(80, 24, "truecolor");
    scene.enter(ctx);
    scene.skipToComplete(false);
    expect(scene.getModel().explorationMode).toBe(true);

    const result = scene.handleKey({ type: "escape" }, ctx);
    expect(result).toEqual({ type: "home" });
  });
});

describe("CastScene exitSignal option", () => {
  test("default esc/q exit to home — the standalone cast flow is unchanged", () => {
    const scene = new CastScene(staticCast(), "reduced");
    expect(scene.handleKey({ type: "escape" }, sceneCtx(80, 24, "truecolor"))).toEqual({ type: "home" });
    expect(scene.handleKey({ type: "char", char: "q" }, sceneCtx(80, 24, "truecolor"))).toEqual({ type: "home" });
  });

  test("exitSignal 'back' routes esc/q to a router pop (journal replay)", () => {
    // The journal factory builds replays with exitSignal "back" so esc pops
    // to the ORIGINAL journal list instead of unwinding the router to Home.
    const scene = new CastScene(staticCast(), "reduced", 80, undefined, 24, undefined, {
      exitSignal: "back",
    });
    scene.skipToComplete(false);
    expect(scene.handleKey({ type: "escape" }, sceneCtx(80, 24, "truecolor"))).toEqual({ type: "back" });
    expect(scene.handleKey({ type: "char", char: "q" }, sceneCtx(80, 24, "truecolor"))).toEqual({ type: "back" });
  });
});

describe("CastScene pace control", () => {
  test("space toggles pause during the reveal", () => {
    const scene = new CastScene(staticCast(), "reduced");
    const ctx = sceneCtx(80, 24, "truecolor");
    scene.enter(ctx);
    scene.update(100, 33, ctx);

    scene.handleKey({ type: "char", char: " " }, ctx);
    expect(scene.getModel().paused).toBe(true);

    // While paused, the timeline does not advance — even a big update is ignored.
    const before = scene.getModel().titleProgress;
    scene.update(scene.getTimeline().duration + 5000, 33, ctx);
    expect(scene.getModel().showPrompt).toBe(false);
    expect(scene.getModel().titleProgress).toBe(before);

    scene.handleKey({ type: "char", char: " " }, ctx);
    expect(scene.getModel().paused).toBe(false);
  });

  test("s skips to the fully revealed state", () => {
    const scene = new CastScene(changingCast(), "reduced", 80);
    const ctx = sceneCtx(80, 24, "truecolor");
    scene.enter(ctx);
    scene.update(100, 33, ctx);

    scene.handleKey({ type: "char", char: "s" }, ctx);
    const model = scene.getModel();
    expect(model.showPrompt).toBe(true);
    expect(model.explorationMode).toBe(true);
    expect(model.layout).toBe("side-by-side");
  });

  test("f cycles speed 1 → 2 → 4 → 1", () => {
    const scene = new CastScene(staticCast(), "reduced");
    const ctx = sceneCtx(80, 24, "truecolor");
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
    const scene = new CastScene(staticCast(), "reduced");
    const ctx = sceneCtx(80, 24, "truecolor");
    scene.enter(ctx);
    scene.skipToComplete(false);
    expect(scene.getModel().showPrompt).toBe(true);

    scene.handleKey({ type: "char", char: " " }, ctx);
    expect(scene.getModel().paused).toBe(false);
    scene.handleKey({ type: "char", char: "f" }, ctx);
    expect(scene.getModel().speed).toBe(1);
  });

  test("pace footer is shown during the reveal", () => {
    const scene = new CastScene(staticCast(), "reduced");
    const ctx = sceneCtx(80, 24, "truecolor");
    scene.enter(ctx);
    scene.update(100, 33, ctx);

    const rows = frameText(scene, ctx);
    expect(rows[ctx.rows - 2]).toContain("[space] pause");
    expect(rows[ctx.rows - 2]).toContain("[esc] back");
  });
});

describe("CastScene reading panel", () => {
  test("[r] reveals the changing lines' texts, read top-down", () => {
    const scene = new CastScene(changingCast(), "reduced", 80);
    const ctx = sceneCtx(80, 24, "truecolor");
    scene.enter(ctx);
    scene.skipToComplete(false);

    // Hidden by default — the bare figure settles first.
    expect(frameText(scene, ctx).join("\n")).not.toContain("Biting on dried gristly meat");

    // [r] reveals it: hexagram 21, lines 1 and 4 read top-down (the upper, 4,
    // first). No method hint line precedes it.
    scene.handleKey({ type: "char", char: "r" }, ctx);
    const text = frameText(scene, ctx).join("\n");
    expect(text).not.toContain("lines move —");
    expect(text).toContain("4 · Biting on dried gristly meat");
  });

  test("[r] reveals the judgment when no lines move", () => {
    const scene = new CastScene(staticCast(), "reduced");
    const ctx = sceneCtx(80, 24, "truecolor");
    scene.enter(ctx);
    scene.skipToComplete(false);
    scene.handleKey({ type: "char", char: "r" }, ctx); // reveal the reading

    const text = frameText(scene, ctx).join("\n");
    // Hexagram 63 既濟 — the judgment is the reading
    expect(text).toContain("Judgment · ");
  });

  test("no reading panel before the reveal settles", () => {
    const scene = new CastScene(changingCast(), "reduced", 80);
    const ctx = sceneCtx(80, 24, "truecolor");
    scene.enter(ctx);
    scene.update(100, 33, ctx);

    const text = frameText(scene, ctx).join("\n");
    expect(text).not.toContain("Biting on dried gristly meat");
  });

  test("the moving-line readings are left-aligned to a common column", () => {
    // A wide frame so neither line wraps: the two readings then have clearly
    // different widths, so per-line centering would land them at different
    // columns. Left-alignment puts both at the panel block's left edge (col 4).
    const cols = 200;
    const scene = new CastScene(changingCast(), "reduced", cols, undefined, 40);
    const ctx: SceneContext = { cols, rows: 40, done: false, colorSupport: "truecolor", language: "en" };
    scene.enter(ctx);
    scene.skipToComplete(false);
    scene.handleKey({ type: "char", char: "r" }, ctx); // reveal the reading

    const rows = frameText(scene, ctx);
    const indent = (s: string): number => s.length - s.trimStart().length;
    const upper = rows.find((r) => r.trimStart().startsWith("4 · ")); // line 4, top
    const lower = rows.find((r) => r.trimStart().startsWith("1 · ")); // line 1, below
    expect(upper).toBeDefined();
    expect(lower).toBeDefined();
    expect(indent(upper!)).toBe(4);
    expect(indent(lower!)).toBe(4);
  });

  test("[r] toggles the reading texts; the figure and prompt stay", () => {
    const scene = new CastScene(changingCast(), "reduced", 80);
    const ctx = sceneCtx(80, 24, "truecolor");
    scene.enter(ctx);
    scene.skipToComplete(false);

    // Hidden by default — the bare figure settles first — and the footer
    // advertises the toggle so it's discoverable.
    const hidden = frameText(scene, ctx).join("\n");
    expect(hidden).not.toContain("Biting on dried gristly meat");
    expect(hidden).toContain("[r] show reading");

    // [r] reveals the reading texts…
    scene.handleKey({ type: "char", char: "r" }, ctx);
    const shown = frameText(scene, ctx).join("\n");
    expect(shown).toContain("Biting on dried gristly meat");
    // …the prompt (and figure beneath it) remain, and the hint flips to hide.
    expect(shown).toContain("[esc] back");
    expect(shown).toContain("[r] hide reading");

    // [r] again hides them.
    scene.handleKey({ type: "char", char: "r" }, ctx);
    const rehidden = frameText(scene, ctx).join("\n");
    expect(rehidden).not.toContain("Biting on dried gristly meat");
    expect(rehidden).toContain("[r] show reading");
  });
});

describe("CastScene openDetail cast context", () => {
  test("primary detail carries the changing positions", () => {
    const scene = new CastScene(changingCast(), "reduced", 80);
    const ctx = sceneCtx(80, 24, "truecolor");
    scene.enter(ctx);
    scene.skipToComplete(false);

    const model = scene.getModel();
    model.focusedHex = "primary";
    const result = scene.handleKey({ type: "enter" }, ctx);
    expect(result).toEqual({ type: "openDetail", kw: 21, changedPositions: [1, 4] });
  });

  test("becoming detail opens without cast context", () => {
    const scene = new CastScene(changingCast(), "reduced", 80);
    const ctx = sceneCtx(80, 24, "truecolor");
    scene.enter(ctx);
    scene.skipToComplete(false);

    scene.getModel().focusedHex = "becoming";
    const result = scene.handleKey({ type: "enter" }, ctx);
    expect(result).toEqual({ type: "openDetail", kw: 42 });
  });

  test("unchanging cast opens primary detail without context", () => {
    const scene = new CastScene(staticCast(), "reduced");
    const ctx = sceneCtx(80, 24, "truecolor");
    scene.enter(ctx);
    scene.skipToComplete(false);
    scene.handleKey({ type: "enter" }, ctx); // enter exploration
    const result = scene.handleKey({ type: "enter" }, ctx);
    expect(result).toEqual({ type: "openDetail", kw: 63 });
  });
});

describe("CastScene journal replay (skipToComplete(false))", () => {
  // The journal factory replays a past entry as a static CastScene. The
  // wave-A reading panel must be there: a replay without the texts the
  // reading turns on would be an empty ritual.
  test("replayed changing cast shows the reading panel and intention", () => {
    const scene = new CastScene(
      changingCast(),
      "reduced",
      80,
      undefined,
      24,
      "the launch question",
      { language: "en" },
    );
    scene.skipToComplete(false);
    const ctx = sceneCtx(80, 24, "truecolor");
    scene.enter(ctx);

    // Intention shows regardless; the reading is hidden by default and revealed
    // with [r].
    expect(scene.getModel().showPrompt).toBe(true);
    const before = frameText(scene, ctx).join("\n");
    expect(before).toContain("the launch question");
    expect(before).not.toContain("Biting on dried gristly meat");

    scene.handleKey({ type: "char", char: "r" }, ctx);
    const text = frameText(scene, ctx).join("\n");
    expect(text).not.toContain("lines move —"); // no method hint line
    expect(text).toContain("4 · Biting on dried gristly meat");
  });

  test("replayed still cast shows the judgment as the reading", () => {
    const scene = new CastScene(staticCast(), "reduced", 80, undefined, 24, undefined, {
      language: "en",
    });
    scene.skipToComplete(false);
    const ctx = sceneCtx(80, 24, "truecolor");
    scene.enter(ctx);
    scene.handleKey({ type: "char", char: "r" }, ctx); // reveal the reading

    const text = frameText(scene, ctx).join("\n");
    expect(text).toContain("Judgment · ");
  });
});
