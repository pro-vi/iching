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

/** Pump dt slices until snap auto-commits. SNAP_HOLD_MS = 250; 3×100 crosses it. */
function pumpThroughSnap(s: YarrowManualScene): void {
  for (let i = 0; i < 5 && s.getPhase() === "snapping"; i++) {
    s.update(0, 100, ctx);
  }
}

/** Advance the sweep by N cells (SWEEP_INTERVAL_MS = 150). */
function pumpSweep(s: YarrowManualScene, cells: number): void {
  for (let i = 0; i < cells; i++) s.update(0, 150, ctx);
}

describe("YarrowManualScene — H6 sweep + snap", () => {
  test("starts in gathering at lineIdx 0 with empty transcript", () => {
    const s = scene();
    expect(s.getPhase()).toBe("gathering");
    expect(s.getLineIdx()).toBe(0);
    expect(s.getModel().fieldCount).toBe(49);
    expect(s.getModel().transcript).toHaveLength(0);
  });

  test("first Space transitions gathering → sweeping at apertureLeft=1", () => {
    const s = scene();
    s.handleKey(space, ctx);
    expect(s.getPhase()).toBe("sweeping");
    expect(s.getApertureLeft()).toBe(1);
  });

  test("sweep advances the aperture rightward over time", () => {
    const s = scene();
    s.handleKey(space, ctx);
    expect(s.getApertureLeft()).toBe(1);
    pumpSweep(s, 5);
    expect(s.getApertureLeft()).toBe(6);
  });

  test("sweep bounces at the right edge (apertureLeft = APERTURE_MAX = 45)", () => {
    const s = scene();
    s.handleKey(space, ctx);
    pumpSweep(s, 50); // overshoots to force a bounce
    // After hitting the right edge, the aperture should now be moving left.
    // Exact position after 50 cells: 1 + 44 right + 6 left = 39 (roughly)
    expect(s.getApertureLeft()).toBeLessThan(45);
    expect(s.getApertureLeft()).toBeGreaterThan(0);
  });

  test("Space during sweeping transitions to snapping (aperture frozen)", () => {
    const s = scene();
    s.handleKey(space, ctx);
    pumpSweep(s, 10);
    const frozen = s.getApertureLeft();
    s.handleKey(space, ctx);
    expect(s.getPhase()).toBe("snapping");
    // Aperture stays put through the snap hold.
    pumpSweep(s, 1); // 150ms; less than SNAP_HOLD_MS (250ms)
    expect(s.getApertureLeft()).toBe(frozen);
  });

  test("snap commits a line with splitAt inside the aperture window", () => {
    const s = scene(42);
    s.handleKey(space, ctx);
    pumpSweep(s, 10); // apertureLeft = 11
    const left = s.getApertureLeft();
    s.handleKey(space, ctx);
    pumpThroughSnap(s);
    expect(s.getPhase()).toBe("playing");
    expect(s.getModel().transcript).toHaveLength(1);
    const k = s.getModel().transcript[0].rounds[0].splitAt;
    expect(k).toBeGreaterThanOrEqual(left);
    expect(k).toBeLessThanOrEqual(left + 3);
    expect(s.getCommittedK()).toBe(k);
  });

  test("escape during sweeping cancels back to gathering for the same line", () => {
    const s = scene();
    s.handleKey(space, ctx);
    pumpSweep(s, 5);
    s.handleKey(escape, ctx);
    expect(s.getPhase()).toBe("gathering");
    expect(s.getLineIdx()).toBe(0);
    expect(s.getApertureLeft()).toBe(1);
    expect(s.getModel().transcript).toHaveLength(0);
  });

  test("escape during gathering exits to home", () => {
    const sig = scene().handleKey(escape, ctx);
    expect(sig).toEqual({ type: "home" });
  });

  test("6 snaps produce a complete cast", () => {
    const s = scene(42);
    for (let line = 0; line < 6; line++) {
      expect(s.getPhase()).toBe("gathering");
      expect(s.getLineIdx()).toBe(line);
      s.handleKey(space, ctx);         // enter sweeping
      pumpSweep(s, 5 + line);          // varied positions
      s.handleKey(space, ctx);         // snap
      pumpThroughSnap(s);
      expect(s.getPhase()).toBe("playing");
      pumpToNextGathering(s);
    }
    expect(s.getPhase()).toBe("complete");
    expect(s.getModel().hexagramComplete).toBe(true);
    expect(s.getModel().transcript).toHaveLength(6);
    expect(s.getModel().requireCast().lines).toHaveLength(6);
  });

  test("final Space emits yarrowCompleted with the assembled cast", () => {
    const s = scene(7);
    for (let line = 0; line < 6; line++) {
      s.handleKey(space, ctx);
      pumpSweep(s, 10);
      s.handleKey(space, ctx);
      pumpThroughSnap(s);
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
    expect(() => s.render(buf, ctx)).not.toThrow(); // sweeping (aperture at 1)
    pumpSweep(s, 20);
    expect(() => s.render(buf, ctx)).not.toThrow(); // sweeping (aperture at 21)
    s.handleKey(space, ctx);
    expect(() => s.render(buf, ctx)).not.toThrow(); // snapping
    pumpThroughSnap(s);
    expect(() => s.render(buf, ctx)).not.toThrow(); // playing
  });
});
