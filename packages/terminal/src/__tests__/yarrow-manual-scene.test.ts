import { describe, test, expect } from "bun:test";
import { SeededRandomSource } from "@iching/core";
import { YarrowManualScene } from "../scenes/yarrow/yarrow-manual-scene.ts";
import { CellBuffer } from "../render/buffer.ts";
import type { SceneContext } from "../scene/types.ts";
import type { KeyEvent } from "../input/key-parser.ts";

const ctx = {} as SceneContext;
const space = { type: "char", char: " " } satisfies KeyEvent;
const escape = { type: "escape" } satisfies KeyEvent;
const ctrlC = { type: "ctrl", char: "c" } satisfies KeyEvent;

function scene(seed = 1): YarrowManualScene {
  const s = new YarrowManualScene("brisk", new SeededRandomSource(seed));
  s.enter(ctx);
  return s;
}

/** Pump dt slices until the current playing atom completes. */
function pumpToWaiting(s: YarrowManualScene): void {
  for (let i = 0; i < 4000 && s.getPhase() === "playing"; i++) {
    s.update(0, 100, ctx);
  }
}

describe("YarrowManualScene", () => {
  test("starts in waiting at atom 0 with the field gathered", () => {
    const s = scene();
    expect(s.getPhase()).toBe("waiting");
    expect(s.getAtomIdx()).toBe(0);
    expect(s.getModel().fieldCount).toBe(49);
    expect(s.getModel().activeLine).toBe(0);
    expect(s.getModel().activeRound).toBe(0);
  });

  test("space in waiting transitions to playing", () => {
    const s = scene();
    s.handleKey(space, ctx);
    expect(s.getPhase()).toBe("playing");
  });

  test("space in playing is ignored (no double-advance)", () => {
    const s = scene();
    s.handleKey(space, ctx);
    expect(s.getAtomIdx()).toBe(0);
    s.handleKey(space, ctx); // ignored while playing
    expect(s.getAtomIdx()).toBe(0);
  });

  test("eighteen Space presses produce a complete cast", () => {
    const s = scene(42);
    for (let i = 0; i < 18; i++) {
      expect(s.getPhase()).toBe("waiting");
      expect(s.getAtomIdx()).toBe(i);
      s.handleKey(space, ctx);
      pumpToWaiting(s);
    }
    expect(s.getPhase()).toBe("complete");
    expect(s.getModel().hexagramComplete).toBe(true);
    expect(s.getModel().cast.lines).toHaveLength(6);
  });

  test("final Space emits yarrowCompleted with the assembled cast", () => {
    const s = scene(7);
    for (let i = 0; i < 18; i++) {
      s.handleKey(space, ctx);
      pumpToWaiting(s);
    }
    const sig = s.handleKey(space, ctx);
    expect(sig).toEqual({ type: "yarrowCompleted", cast: s.getModel().cast });
  });

  test("third round of each line lifts that line's progress to 1", () => {
    const s = scene(5);
    for (let line = 0; line < 6; line++) {
      // Three round-atoms per line; the third includes the fuse beat.
      for (let r = 0; r < 3; r++) {
        s.handleKey(space, ctx);
        pumpToWaiting(s);
      }
      expect(s.getModel().lines[line].settled).toBe(true);
      expect(s.getModel().lines[line].progress).toBe(1);
    }
  });

  test("escape returns home with no cast emitted", () => {
    const sig = scene().handleKey(escape, ctx);
    expect(sig).toEqual({ type: "home" });
  });

  test("ctrl-c exits at any phase", () => {
    expect(scene().handleKey(ctrlC, ctx)).toEqual({ type: "exit" });
  });

  test("render does not throw for any phase", () => {
    const s = scene();
    const buf = new CellBuffer(80, 24);
    expect(() => s.render(buf, ctx)).not.toThrow(); // waiting
    s.handleKey(space, ctx);
    expect(() => s.render(buf, ctx)).not.toThrow(); // playing
    pumpToWaiting(s);
    expect(() => s.render(buf, ctx)).not.toThrow(); // waiting again
  });
});
