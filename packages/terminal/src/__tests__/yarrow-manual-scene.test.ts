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

/** Pump dt slices until the current playing round (or round+fuse) completes. */
function pumpToNextGathering(s: YarrowManualScene): void {
  for (let i = 0; i < 4000 && s.getPhase() === "playing"; i++) {
    s.update(0, 100, ctx);
  }
}

/** Trigger snap commit by pumping enough silence to cross SNAP_HOLD_MS (250ms). */
function pumpThroughSnap(s: YarrowManualScene): void {
  for (let i = 0; i < 5 && s.getPhase() === "snapping"; i++) {
    s.update(0, 100, ctx);
  }
}

/** Advance the sweep by N cells (SWEEP_INTERVAL_MS = 150). */
function pumpSweep(s: YarrowManualScene, cells: number): void {
  for (let i = 0; i < cells; i++) s.update(0, 150, ctx);
}

/** Run one round atom (sweep some cells, snap, wait for play to complete). */
function runRound(s: YarrowManualScene, sweepCells: number): void {
  s.handleKey(space, ctx);            // gathering → sweeping
  pumpSweep(s, sweepCells);
  s.handleKey(space, ctx);            // sweeping → snapping
  pumpThroughSnap(s);                 // snapping → playing
  pumpToNextGathering(s);             // playing → gathering (next atom)
}

describe("YarrowManualScene — 18-cut full manual", () => {
  test("starts in gathering at atom 0 with empty transcript", () => {
    const s = scene();
    expect(s.getPhase()).toBe("gathering");
    expect(s.getAtomIdx()).toBe(0);
    expect(s.getLineIdx()).toBe(0);
    expect(s.getRoundIdx()).toBe(0);
    expect(s.getCurrentStartCount()).toBe(49);
    expect(s.getModel().transcript).toHaveLength(0);
  });

  test("first Space transitions gathering → sweeping at apertureLeft=1", () => {
    const s = scene();
    s.handleKey(space, ctx);
    expect(s.getPhase()).toBe("sweeping");
    expect(s.getApertureLeft()).toBe(1);
  });

  test("sweep advances aperture rightward", () => {
    const s = scene();
    s.handleKey(space, ctx);
    pumpSweep(s, 5);
    expect(s.getApertureLeft()).toBe(6);
  });

  test("Space during sweeping transitions to snapping (aperture frozen)", () => {
    const s = scene();
    s.handleKey(space, ctx);
    pumpSweep(s, 10);
    const frozen = s.getApertureLeft();
    s.handleKey(space, ctx);
    expect(s.getPhase()).toBe("snapping");
    pumpSweep(s, 1);
    expect(s.getApertureLeft()).toBe(frozen);
  });

  test("snap commits round 0 with splitAt inside the aperture window", () => {
    const s = scene(42);
    s.handleKey(space, ctx);
    pumpSweep(s, 10);                  // apertureLeft = 11
    const left = s.getApertureLeft();
    s.handleKey(space, ctx);
    pumpThroughSnap(s);
    expect(s.getPhase()).toBe("playing");
    expect(s.getModel().transcript[0].rounds[0]).toBeDefined();
    const k = s.getModel().transcript[0].rounds[0].splitAt;
    expect(k).toBeGreaterThanOrEqual(left);
    expect(k).toBeLessThanOrEqual(left + 3);
    expect(s.getCommittedK()).toBe(k);
  });

  test("after round 0 commits, atomIdx advances to 1 (line 0, round 1)", () => {
    const s = scene();
    runRound(s, 5);
    expect(s.getAtomIdx()).toBe(1);
    expect(s.getLineIdx()).toBe(0);
    expect(s.getRoundIdx()).toBe(1);
    // Round 2's pile is round 1's remaining, not 49.
    expect(s.getCurrentStartCount()).toBeLessThan(49);
    expect(s.getCurrentStartCount()).toBeGreaterThanOrEqual(40);
  });

  test("aperture max shrinks with pile size on round 2+", () => {
    const s = scene();
    runRound(s, 5);  // commit round 0; now in round 1's gathering
    expect(s.getApertureLeft()).toBe(1);
    // Sweep far enough to hit the right edge of round 1's smaller pile.
    s.handleKey(space, ctx);
    pumpSweep(s, 100);  // overshoots
    // Aperture should have bounced before reaching apertureMax for 49.
    const startCount = s.getCurrentStartCount();
    expect(s.getApertureLeft()).toBeLessThanOrEqual(startCount - 4);
  });

  test("escape during sweeping cancels back to gathering for same atom", () => {
    const s = scene();
    s.handleKey(space, ctx);
    pumpSweep(s, 5);
    s.handleKey(escape, ctx);
    expect(s.getPhase()).toBe("gathering");
    expect(s.getAtomIdx()).toBe(0);
    expect(s.getApertureLeft()).toBe(1);
  });

  test("escape during gathering exits to home", () => {
    const sig = scene().handleKey(escape, ctx);
    expect(sig).toEqual({ type: "home" });
  });

  test("18 snaps produce a complete cast", () => {
    const s = scene(42);
    for (let atom = 0; atom < 18; atom++) {
      expect(s.getPhase()).toBe("gathering");
      expect(s.getAtomIdx()).toBe(atom);
      runRound(s, 3 + (atom % 5));      // varied sweep distances
    }
    expect(s.getPhase()).toBe("complete");
    expect(s.getModel().hexagramComplete).toBe(true);
    expect(s.getModel().transcript).toHaveLength(6);
    for (const lineResult of s.getModel().transcript) {
      expect(lineResult.rounds).toHaveLength(3);
      expect(lineResult.line).not.toBeNull();
    }
    expect(s.getModel().requireCast().lines).toHaveLength(6);
  });

  test("final Space emits yarrowCompleted with the assembled cast", () => {
    const s = scene(7);
    for (let atom = 0; atom < 18; atom++) runRound(s, 4);
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
    expect(() => s.render(buf, ctx)).not.toThrow();
    s.handleKey(space, ctx);
    expect(() => s.render(buf, ctx)).not.toThrow(); // snapping
    pumpThroughSnap(s);
    expect(() => s.render(buf, ctx)).not.toThrow(); // playing
  });
});
