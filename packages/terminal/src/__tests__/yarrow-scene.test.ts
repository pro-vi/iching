import { describe, test, expect } from "bun:test";
import { SeededRandomSource } from "@iching/core";
import { YarrowScene } from "../scenes/yarrow/yarrow-scene.ts";
import { CellBuffer } from "../render/buffer.ts";
import type { SceneContext } from "../scene/types.ts";
import type { KeyEvent } from "../input/key-parser.ts";

const ctx = {} as SceneContext;
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
    expect(sig).toEqual({ type: "yarrowCompleted", cast: s.getModel().cast });
  });

  test("escape before completion returns home with no cast", () => {
    const sig = scene().handleKey(key({ type: "escape" }), ctx);
    expect(sig).toEqual({ type: "home" });
  });

  test("ctrl-c exits at any point", () => {
    const sig = scene().handleKey(key({ type: "ctrl", char: "c" }), ctx);
    expect(sig).toEqual({ type: "exit" });
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
