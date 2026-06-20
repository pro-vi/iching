import { describe, test, expect } from "bun:test";
import { CastScene } from "../scenes/cast/cast-scene.ts";
import type { Cast } from "@iching/core";
import { lineOf } from "@iching/core/testing";
import type { SceneContext } from "../scene/types.ts";

const mockCast: Cast = {
  lines: [lineOf(7), lineOf(8), lineOf(7), lineOf(7), lineOf(8), lineOf(7)],
  primary: 1,
  becoming: null,
  changingPositions: [],
  nuclear: 1,
  polarity: 2,
  mirror: 1,
  diagonal: 2,
};

function makeCtx(): SceneContext {
  return { cols: 80, rows: 24, done: false, colorSupport: "none" };
}

describe("CastScene dictionary key", () => {
  test("[d] returns dictionary goto when prompt shown", () => {
    const scene = new CastScene(mockCast, "reduced", 80);
    // Force prompt to show
    scene.getModel().showPrompt = true;

    const signal = scene.handleKey({ type: "char", char: "d" }, makeCtx());
    expect(signal).toEqual({ type: "openDictionary" });
  });

  test("[d] does nothing before prompt shown", () => {
    const scene = new CastScene(mockCast, "reduced", 80);
    scene.getModel().showPrompt = false;

    const signal = scene.handleKey({ type: "char", char: "d" }, makeCtx());
    expect(signal).toBeUndefined();
  });
});
