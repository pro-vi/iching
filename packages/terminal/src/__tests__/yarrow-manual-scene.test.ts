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

/** Pump dt slices until the current playing line completes. */
function pumpToNextGathering(s: YarrowManualScene): void {
  for (let i = 0; i < 4000 && s.getPhase() === "playing"; i++) {
    s.update(0, 100, ctx);
  }
}

/** Trigger release by pumping enough silence to cross the RELEASE_MS threshold. */
function pumpToRelease(s: YarrowManualScene): void {
  // RELEASE_MS = 250; three 100ms ticks crosses it.
  for (let i = 0; i < 5 && s.getPhase() === "dragging"; i++) {
    s.update(0, 100, ctx);
  }
}

describe("YarrowManualScene — H4 hold-release", () => {
  test("starts in gathering at lineIdx 0 with empty transcript", () => {
    const s = scene();
    expect(s.getPhase()).toBe("gathering");
    expect(s.getLineIdx()).toBe(0);
    expect(s.getCursorK()).toBe(0);
    expect(s.getModel().fieldCount).toBe(49);
    expect(s.getModel().transcript).toHaveLength(0);
  });

  test("first Space transitions gathering → dragging at cursorK=1", () => {
    const s = scene();
    s.handleKey(space, ctx);
    expect(s.getPhase()).toBe("dragging");
    expect(s.getCursorK()).toBe(1);
  });

  test("subsequent Space presses increment cursorK", () => {
    const s = scene();
    s.handleKey(space, ctx);                     // cursorK = 1 (enters drag)
    for (let i = 0; i < 11; i++) s.handleKey(space, ctx); // +11 → 12
    expect(s.getCursorK()).toBe(12);
    expect(s.getPhase()).toBe("dragging");
  });

  test("cursorK saturates at 48 even with extra presses", () => {
    const s = scene();
    for (let i = 0; i < 60; i++) s.handleKey(space, ctx);
    expect(s.getCursorK()).toBe(48);
  });

  test("silence for RELEASE_MS commits the cut and transitions to playing", () => {
    const s = scene();
    for (let i = 0; i < 15; i++) s.handleKey(space, ctx); // cursorK = 15
    pumpToRelease(s);
    expect(s.getPhase()).toBe("playing");
    expect(s.getModel().transcript).toHaveLength(1);
    expect(s.getModel().transcript[0].rounds[0].splitAt).toBe(15);
  });

  test("escape during dragging cancels and returns to gathering for same line", () => {
    const s = scene();
    for (let i = 0; i < 10; i++) s.handleKey(space, ctx);
    s.handleKey(escape, ctx);
    expect(s.getPhase()).toBe("gathering");
    expect(s.getLineIdx()).toBe(0);
    expect(s.getCursorK()).toBe(0);
    expect(s.getModel().transcript).toHaveLength(0);
  });

  test("escape during gathering exits to home", () => {
    const sig = scene().handleKey(escape, ctx);
    expect(sig).toEqual({ type: "home" });
  });

  test("6 cuts produce a complete cast", () => {
    const s = scene(42);
    const targetKs = [12, 24, 36, 8, 32, 18];
    for (let line = 0; line < 6; line++) {
      expect(s.getPhase()).toBe("gathering");
      expect(s.getLineIdx()).toBe(line);
      for (let i = 0; i < targetKs[line]; i++) s.handleKey(space, ctx);
      pumpToRelease(s);
      expect(s.getPhase()).toBe("playing");
      pumpToNextGathering(s);
    }
    expect(s.getPhase()).toBe("complete");
    expect(s.getModel().hexagramComplete).toBe(true);
    expect(s.getModel().transcript).toHaveLength(6);
    for (let line = 0; line < 6; line++) {
      expect(s.getModel().transcript[line].rounds[0].splitAt).toBe(targetKs[line]);
    }
    // commitCast ran; requireCast returns a valid Cast with 6 lines.
    expect(s.getModel().requireCast().lines).toHaveLength(6);
  });

  test("final Space emits yarrowCompleted with the assembled cast", () => {
    const s = scene(7);
    for (let line = 0; line < 6; line++) {
      for (let i = 0; i < 8; i++) s.handleKey(space, ctx); // arbitrary k=8 per line
      pumpToRelease(s);
      pumpToNextGathering(s);
    }
    const sig = s.handleKey(space, ctx);
    expect(sig).toEqual({ type: "yarrowCompleted", cast: s.getModel().requireCast() });
  });

  test("ctrl-c exits at any phase", () => {
    expect(scene().handleKey(ctrlC, ctx)).toEqual({ type: "exit" });
  });

  test("render does not throw for any phase", () => {
    const s = scene();
    const buf = new CellBuffer(80, 24);
    expect(() => s.render(buf, ctx)).not.toThrow(); // gathering
    s.handleKey(space, ctx);
    expect(() => s.render(buf, ctx)).not.toThrow(); // dragging
    for (let i = 0; i < 10; i++) s.handleKey(space, ctx);
    expect(() => s.render(buf, ctx)).not.toThrow(); // dragging with cursorK=11
    pumpToRelease(s);
    expect(() => s.render(buf, ctx)).not.toThrow(); // playing
  });
});
