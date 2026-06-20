import { describe, test, expect } from "bun:test";
import { rowText } from "../testing.ts";
import { SeededRandomSource } from "@iching/core";
import { YarrowScene } from "../scenes/yarrow/yarrow-scene.ts";
import { CellBuffer } from "../render/buffer.ts";
import type { SceneContext } from "../scene/types.ts";
import type { KeyEvent } from "../input/key-parser.ts";

// A context comfortably above the yarrow field floor (52 × 21), so update/
// handleKey run the ritual; the size-gate tests below pass their own small dims.
const ctx = { cols: 80, rows: 40, colorSupport: "truecolor", language: "en", done: false } as SceneContext;
const smallCtx = { cols: 41, rows: 12, colorSupport: "truecolor", language: "en", done: false } as SceneContext;
const key = (k: Partial<KeyEvent>): KeyEvent => k as KeyEvent;

function scene(seed = 1): YarrowScene {
  return new YarrowScene("default", new SeededRandomSource(seed));
}

function runToCompletion(s: YarrowScene): void {
  for (let i = 0; i < 4000 && !s.getModel().hexagramComplete; i++) {
    s.update(0, 500, ctx);
  }
}

describe("YarrowScene", () => {
  test("runs to completion and emits yarrowCompleted with the cast", () => {
    const s = scene(42);
    runToCompletion(s);
    expect(s.getModel().hexagramComplete).toBe(true);

    const sig = s.handleKey(key({ type: "char", char: " " }), ctx);
    expect(sig).toEqual({ type: "yarrowCompleted", cast: s.getModel().requireCast() });
  });

  test("escape before completion returns home with no cast", () => {
    const sig = scene().handleKey(key({ type: "escape" }), ctx);
    expect(sig).toEqual({ type: "home" });
  });

  function renderAt(s: YarrowScene, cols: number, rows: number): string {
    const buf = CellBuffer.create(cols, rows);
    s.render(buf, { cols, rows, colorSupport: "truecolor", language: "en", done: false });
    return Array.from({ length: rows }, (_, r) => rowText(buf, r)).join(
      "\n",
    );
  }

  test("gates on its 52-col field need — a narrow terminal gets a calm notice", () => {
    const s = scene(42);
    // Below the field's 52-col need but above the global 40 floor (held tall so
    // only width gates): the ritual would render a clipped half-field, so it
    // shows the too-small notice with its OWN requirement (52 × 21), not the
    // misleading global 40 × 12.
    for (const cols of [41, 45, 51]) {
      const out = renderAt(s, cols, 24);
      expect(out).toContain("the window is too small");
      expect(out).toContain("52 × 21");
    }
    // At a comfortable size the field renders (its pace-control footer shows).
    expect(renderAt(s, 80, 24)).toContain("[space]");
  });

  test("gates on its 21-row field need — a short terminal gets a calm notice", () => {
    const s = scene(42);
    // The counting field is anchored low (fieldRow = floor(h/2) + 8); below 21
    // rows the stalk bar overlaps the keybind footer. Held wide so only height
    // gates — at 20 and below the notice shows, at 21 the ritual renders.
    for (const rows of [12, 16, 20]) {
      const out = renderAt(s, 80, rows);
      expect(out).toContain("the window is too small");
      expect(out).toContain("52 × 21");
    }
    expect(renderAt(s, 80, 21)).toContain("[space]"); // exactly at the floor it renders
  });

  test("ctrl-c exits at any point", () => {
    const sig = scene().handleKey(key({ type: "ctrl", char: "c" }), ctx);
    expect(sig).toEqual({ type: "exit" });
  });

  test("below the field floor the ritual freezes — update does not advance unseen", () => {
    // The too-small notice is render-only; without gating update, the virtual
    // clock kept ticking and the ritual could silently complete behind the
    // notice. A cramped terminal must hold the ritual where it is.
    const s = scene(42);
    const line = s.getModel().activeLine;
    const round = s.getModel().activeRound;
    for (let i = 0; i < 100; i++) s.update(0, 500, smallCtx);
    expect(s.getModel().activeLine).toBe(line);
    expect(s.getModel().activeRound).toBe(round);
    expect(s.getModel().hexagramComplete).toBe(false);
  });

  test("below the field floor ritual keys are ignored, but esc/ctrl-c still leave", () => {
    const s = scene();
    s.handleKey(key({ type: "char", char: " " }), smallCtx); // pace key ignored…
    expect(s.getModel().paused).toBe(false);
    s.handleKey(key({ type: "char", char: "f" }), smallCtx); // …speed key ignored…
    expect(s.getModel().speed).toBe(1);
    expect(s.handleKey(key({ type: "escape" }), smallCtx)).toEqual({ type: "home" }); // …leaving works
    expect(s.handleKey(key({ type: "ctrl", char: "c" }), smallCtx)).toEqual({ type: "exit" });
  });

  test("a completed figure does not 'receive' while below the field floor", () => {
    // The figure stands, but the field is hidden behind the notice — space must
    // not commit the reading the user can't see. Resizing back up restores it.
    const s = scene(7);
    s.handleKey(key({ type: "char", char: "s" }), ctx); // skip to the finished figure
    expect(s.getModel().hexagramComplete).toBe(true);
    expect(s.handleKey(key({ type: "char", char: " " }), smallCtx)).toBeUndefined(); // hidden → no receive
    expect(s.handleKey(key({ type: "char", char: " " }), ctx)).toEqual({
      type: "yarrowCompleted",
      cast: s.getModel().requireCast(),
    });
  });

  test("space pauses — the ritual stops advancing", () => {
    const s = scene();
    s.update(0, 500, ctx);
    s.handleKey(key({ type: "char", char: " " }), ctx);
    expect(s.getModel().paused).toBe(true);

    const line = s.getModel().activeLine;
    const round = s.getModel().activeRound;
    for (let i = 0; i < 30; i++) s.update(0, 500, ctx);
    expect(s.getModel().activeLine).toBe(line);
    expect(s.getModel().activeRound).toBe(round);
  });

  test("f cycles playback speed 1 → 2 → 4 → 1", () => {
    const s = scene();
    expect(s.getModel().speed).toBe(1);
    s.handleKey(key({ type: "char", char: "f" }), ctx);
    expect(s.getModel().speed).toBe(2);
    s.handleKey(key({ type: "char", char: "f" }), ctx);
    expect(s.getModel().speed).toBe(4);
    s.handleKey(key({ type: "char", char: "f" }), ctx);
    expect(s.getModel().speed).toBe(1);
  });

  test("right-arrow steps to the next beat while paused", () => {
    const s = scene();
    s.handleKey(key({ type: "char", char: " " }), ctx);
    s.handleKey(key({ type: "arrow", direction: "right" }), ctx);
    expect(s.getModel().activeLine).toBe(0);
    expect(s.getModel().beat).not.toBe("idle");
  });

  test("s skips straight to the finished figure", () => {
    const s = scene(7);
    s.handleKey(key({ type: "char", char: "s" }), ctx);
    expect(s.getModel().hexagramComplete).toBe(true);
    expect(s.getModel().lines.every((l) => l.settled)).toBe(true);
  });

  test("skipToComplete lands the same state as a full natural run", () => {
    const full = scene(11);
    runToCompletion(full);
    const skipped = scene(11);
    skipped.skipToComplete();

    expect(skipped.getModel().cast).toEqual(full.getModel().cast);
    expect(skipped.getModel().lines.map((l) => l.progress)).toEqual(
      full.getModel().lines.map((l) => l.progress),
    );
    expect(skipped.getModel().hexagramComplete).toBe(true);
  });

  test("render shows the receive prompt once the figure stands", () => {
    const s = scene();
    s.skipToComplete();
    const buf = new CellBuffer(80, 24);
    s.render(buf, ctx);
    let footer = "";
    for (let c = 0; c < 80; c++) footer += buf.getCell(22, c).char;
    expect(footer).toContain("receive");
  });
});
