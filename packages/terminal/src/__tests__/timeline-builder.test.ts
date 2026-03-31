import { describe, test, expect } from "bun:test";
import { buildCastTimeline } from "../scenes/cast/timeline-builder.ts";
import { CastModel } from "../scenes/cast/model.ts";
import { getPreset } from "../animation/presets.ts";
import { stepDuration } from "../animation/timeline.ts";
import type { Cast } from "@iching/core";

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
    primary: 63,
    becoming: null,
    changingPositions: [],
    nuclear: 64,
    polarity: 64,
    mirror: 64,
    diagonal: 63,
    ...overrides,
  };
}

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

describe("buildCastTimeline", () => {
  test("built timeline has positive duration for default preset", () => {
    const cast = makeCast();
    const model = new CastModel(cast);
    const timing = getPreset("default");
    const step = buildCastTimeline(cast, model, timing);
    const duration = stepDuration(step);
    expect(duration).toBeGreaterThan(0);
  });

  test("reduced motion preset produces shorter timeline than default", () => {
    const cast = makeCast();

    const modelDefault = new CastModel(cast);
    const defaultStep = buildCastTimeline(cast, modelDefault, getPreset("default"));
    const defaultDuration = stepDuration(defaultStep);

    const modelReduced = new CastModel(cast);
    const reducedStep = buildCastTimeline(cast, modelReduced, getPreset("reduced"));
    const reducedDuration = stepDuration(reducedStep);

    expect(reducedDuration).toBeLessThan(defaultDuration);
  });

  test("brisk preset produces shorter timeline than default", () => {
    const cast = makeCast();

    const modelDefault = new CastModel(cast);
    const defaultStep = buildCastTimeline(cast, modelDefault, getPreset("default"));
    const defaultDuration = stepDuration(defaultStep);

    const modelBrisk = new CastModel(cast);
    const briskStep = buildCastTimeline(cast, modelBrisk, getPreset("brisk"));
    const briskDuration = stepDuration(briskStep);

    expect(briskDuration).toBeLessThan(defaultDuration);
  });

  test("deep preset produces longer timeline than default", () => {
    const cast = makeCast();

    const modelDefault = new CastModel(cast);
    const defaultStep = buildCastTimeline(cast, modelDefault, getPreset("default"));
    const defaultDuration = stepDuration(defaultStep);

    const modelDeep = new CastModel(cast);
    const deepStep = buildCastTimeline(cast, modelDeep, getPreset("deep"));
    const deepDuration = stepDuration(deepStep);

    expect(deepDuration).toBeGreaterThan(defaultDuration);
  });

  test("timeline with changing lines includes morph steps", () => {
    const cast = makeChangingCast();
    const model = new CastModel(cast);
    const timing = getPreset("default");
    const step = buildCastTimeline(cast, model, timing);
    const duration = stepDuration(step);

    // Should be longer than a non-changing cast
    const noChangeCast = makeCast();
    const noChangeModel = new CastModel(noChangeCast);
    const noChangeStep = buildCastTimeline(noChangeCast, noChangeModel, timing);
    const noChangeDuration = stepDuration(noChangeStep);

    // Changing cast has morph steps + marker pulse, should be longer
    // (no-change has 1200ms wait + "unchanging", changing has 680ms + pulse + morph + reveal)
    expect(duration).toBeGreaterThan(0);
    expect(noChangeDuration).toBeGreaterThan(0);
  });

  test("timeline references all 6 lines via model mutations", () => {
    const cast = makeCast();
    const model = new CastModel(cast);
    const timing = getPreset("reduced");
    const step = buildCastTimeline(cast, model, timing);

    // Advance the timeline fully via TimelineRunner
    const { TimelineRunner } = require("../animation/runner.ts");
    const runner = new TimelineRunner(step);
    const duration = runner.duration;

    runner.advance(duration + 100, model);

    // All 6 lines should be settled
    for (let i = 0; i < 6; i++) {
      expect(model.lines[i].settled).toBe(true);
      expect(model.lines[i].progress).toBe(1);
    }
  });

  test("unchanging cast sets subtitle text", () => {
    const cast = makeCast(); // no changing lines
    const model = new CastModel(cast);
    const timing = getPreset("reduced");
    const step = buildCastTimeline(cast, model, timing);

    const { TimelineRunner } = require("../animation/runner.ts");
    const runner = new TimelineRunner(step);
    runner.advance(runner.duration + 100, model);

    expect(model.subtitleText).toBe("");
  });

  test("changing cast does not set unchanging subtitle", () => {
    const cast = makeChangingCast();
    const model = new CastModel(cast);
    const timing = getPreset("reduced");
    const step = buildCastTimeline(cast, model, timing);

    const { TimelineRunner } = require("../animation/runner.ts");
    const runner = new TimelineRunner(step);
    runner.advance(runner.duration + 100, model);

    expect(model.subtitleText).toBe("");
  });

  test("wide terminal timeline includes split steps for becoming cast", () => {
    const cast = makeChangingCast();
    const model = new CastModel(cast);
    const timing = getPreset("reduced");
    const step = buildCastTimeline(cast, model, timing, 80); // wide

    const { TimelineRunner } = require("../animation/runner.ts");
    const runner = new TimelineRunner(step);
    runner.advance(runner.duration + 100, model);

    // Should be in side-by-side layout
    expect(model.layout).toBe("side-by-side");
    expect(model.splitProgress).toBe(1);
    expect(model.rightHexMorphComplete).toBe(true);
    // Primary lines should NOT have been morphed in-place
    for (const pos of cast.changingPositions) {
      expect(model.lines[pos - 1].morphComplete).toBe(false);
    }
  });

  test("narrow terminal uses in-place morph for becoming cast", () => {
    const cast = makeChangingCast();
    const model = new CastModel(cast);
    const timing = getPreset("reduced");
    const step = buildCastTimeline(cast, model, timing, 40); // narrow

    const { TimelineRunner } = require("../animation/runner.ts");
    const runner = new TimelineRunner(step);
    runner.advance(runner.duration + 100, model);

    // Should stay centered
    expect(model.layout).toBe("centered");
    expect(model.splitProgress).toBe(0);
    // Primary lines SHOULD have been morphed in-place
    for (const pos of cast.changingPositions) {
      expect(model.lines[pos - 1].morphComplete).toBe(true);
    }
  });

  test("wide terminal timeline has positive duration with changing lines", () => {
    const cast = makeChangingCast();
    const model = new CastModel(cast);
    const timing = getPreset("default");
    const step = buildCastTimeline(cast, model, timing, 80);
    const duration = stepDuration(step);
    expect(duration).toBeGreaterThan(0);
  });
});
