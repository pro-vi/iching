import { describe, test, expect } from "bun:test";
import { changingCast, staticCast } from "../testing.ts";
import { buildCastTimeline, type CastGlyphConfig } from "../scenes/cast/timeline-builder.ts";
import { CastModel } from "../scenes/cast/model.ts";
import { getPreset } from "../animation/presets.ts";
import { stepDuration } from "../animation/timeline.ts";
import { GLYPH_ANIM_DURATION_MS } from "../glyph-anim/factory.ts";

describe("buildCastTimeline", () => {
  test("built timeline has positive duration for default preset", () => {
    const cast = staticCast();
    const model = new CastModel(cast);
    const timing = getPreset("default");
    const step = buildCastTimeline(cast, model, timing);
    const duration = stepDuration(step);
    expect(duration).toBeGreaterThan(0);
  });

  test("reduced motion preset produces shorter timeline than default", () => {
    const cast = staticCast();

    const modelDefault = new CastModel(cast);
    const defaultStep = buildCastTimeline(cast, modelDefault, getPreset("default"));
    const defaultDuration = stepDuration(defaultStep);

    const modelReduced = new CastModel(cast);
    const reducedStep = buildCastTimeline(cast, modelReduced, getPreset("reduced"));
    const reducedDuration = stepDuration(reducedStep);

    expect(reducedDuration).toBeLessThan(defaultDuration);
  });

  test("brisk preset produces shorter timeline than default", () => {
    const cast = staticCast();

    const modelDefault = new CastModel(cast);
    const defaultStep = buildCastTimeline(cast, modelDefault, getPreset("default"));
    const defaultDuration = stepDuration(defaultStep);

    const modelBrisk = new CastModel(cast);
    const briskStep = buildCastTimeline(cast, modelBrisk, getPreset("brisk"));
    const briskDuration = stepDuration(briskStep);

    expect(briskDuration).toBeLessThan(defaultDuration);
  });

  test("deep preset produces longer timeline than default", () => {
    const cast = staticCast();

    const modelDefault = new CastModel(cast);
    const defaultStep = buildCastTimeline(cast, modelDefault, getPreset("default"));
    const defaultDuration = stepDuration(defaultStep);

    const modelDeep = new CastModel(cast);
    const deepStep = buildCastTimeline(cast, modelDeep, getPreset("deep"));
    const deepDuration = stepDuration(deepStep);

    expect(deepDuration).toBeGreaterThan(defaultDuration);
  });

  test("timeline with changing lines includes morph steps", () => {
    const cast = changingCast();
    const model = new CastModel(cast);
    const timing = getPreset("default");
    const step = buildCastTimeline(cast, model, timing); // default width 80 → split + morph
    expect(stepDuration(step)).toBeGreaterThan(0);
    expect(cast.changingPositions.length).toBeGreaterThan(0);

    // "Includes morph steps": advancing the changing timeline must drive the
    // becoming-hexagram morph to completion — a static cast builds no such step.
    // The old test computed a no-change duration it never compared, so it pinned
    // nothing about morphing.
    const { TimelineRunner } = require("../animation/runner.ts");
    const runner = new TimelineRunner(step);
    runner.advance(runner.duration + 100, model);
    expect(model.rightHexMorphComplete).toBe(true);
  });

  test("timeline references all 6 lines via model mutations", () => {
    const cast = staticCast();
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

  test("unchanging cast clears the subtitle (buildUnchangingHold resets it)", () => {
    const cast = staticCast(); // no changing lines
    const model = new CastModel(cast);
    model.subtitleText = "STALE"; // pre-dirty so the assertion proves the reset RUNS
    const timing = getPreset("reduced");
    const step = buildCastTimeline(cast, model, timing);

    const { TimelineRunner } = require("../animation/runner.ts");
    const runner = new TimelineRunner(step);
    runner.advance(runner.duration + 100, model);

    // Stays "STALE" if buildUnchangingHold's reset is dropped — the old test
    // asserted the constructor default ("") and could never fail.
    expect(model.subtitleText).toBe("");
  });

  test("changing cast leaves the subtitle untouched (unchanging-hold is skipped)", () => {
    const cast = changingCast();
    const model = new CastModel(cast);
    model.subtitleText = "STALE"; // pre-dirty: the changing path must not run the reset
    const timing = getPreset("reduced");
    const step = buildCastTimeline(cast, model, timing);

    const { TimelineRunner } = require("../animation/runner.ts");
    const runner = new TimelineRunner(step);
    runner.advance(runner.duration + 100, model);

    // The only runtime writer of subtitleText is buildUnchangingHold (unchanging
    // path only); a changing cast must leave the pre-dirtied value as-is.
    expect(model.subtitleText).toBe("STALE");
  });

  test("wide terminal timeline includes split steps for becoming cast", () => {
    const cast = changingCast();
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
    const cast = changingCast();
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
    const cast = changingCast();
    const model = new CastModel(cast);
    const timing = getPreset("default");
    const step = buildCastTimeline(cast, model, timing, 80);
    const duration = stepDuration(step);
    expect(duration).toBeGreaterThan(0);
  });
});

describe("glyph reveal timing", () => {
  function makeGlyphConfig(anim: CastGlyphConfig["glyphAnim"]): CastGlyphConfig {
    return { glyphAnim: anim, glyphFont: "kaiti", glyphSize: 32 };
  }

  test("reveal hold tracks the chosen style's duration", () => {
    const cast = staticCast();
    const timing = getPreset("default");
    const sand = buildCastTimeline(cast, new CastModel(cast), timing, 80, makeGlyphConfig("sand"));
    const radial = buildCastTimeline(cast, new CastModel(cast), timing, 80, makeGlyphConfig("radial"));
    expect(stepDuration(sand) - stepDuration(radial)).toBe(
      GLYPH_ANIM_DURATION_MS.sand - GLYPH_ANIM_DURATION_MS.radial,
    );
  });

  test("glyphAnimScale scales the reveal hold", () => {
    const cast = staticCast();
    const base = getPreset("default");
    const halved = { ...base, glyphAnimScale: 0.5 };
    const full = buildCastTimeline(cast, new CastModel(cast), base, 80, makeGlyphConfig("noise"));
    const half = buildCastTimeline(cast, new CastModel(cast), halved, 80, makeGlyphConfig("noise"));
    expect(stepDuration(full) - stepDuration(half)).toBe(
      Math.round(GLYPH_ANIM_DURATION_MS.noise * 0.5),
    );
  });

  test("reduced motion shows the settled glyph immediately, no animation", () => {
    const cast = staticCast();
    const model = new CastModel(cast);
    const timing = getPreset("reduced");
    const step = buildCastTimeline(cast, model, timing, 80, makeGlyphConfig("noise"));

    const { TimelineRunner } = require("../animation/runner.ts");
    const runner = new TimelineRunner(step);
    runner.advance(runner.duration + 100, model);

    expect(model.primaryGlyphEntry).not.toBeNull();
    expect(model.glyphAnimator).toBeNull();
    expect(model.glyphAnimDone).toBe(true);
  });

  test("non-reduced presets create a real animator", () => {
    const cast = staticCast();
    const model = new CastModel(cast);
    const timing = getPreset("default");
    const step = buildCastTimeline(cast, model, timing, 80, makeGlyphConfig("noise"));

    const { TimelineRunner } = require("../animation/runner.ts");
    const runner = new TimelineRunner(step);
    runner.advance(runner.duration + 100, model);

    expect(model.primaryGlyphEntry).not.toBeNull();
    expect(model.glyphAnimator).not.toBeNull();
  });
});
