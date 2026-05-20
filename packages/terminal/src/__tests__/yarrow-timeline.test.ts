import { describe, test, expect } from "bun:test";
import { castYarrowHexagram, SeededRandomSource } from "@iching/core";
import { TimelineRunner } from "../animation/runner.ts";
import { getYarrowTiming } from "../animation/yarrow-presets.ts";
import { YarrowModel } from "../scenes/yarrow/model.ts";
import { buildYarrowTimeline } from "../scenes/yarrow/yarrow-timeline.ts";

function model(seed = 1): YarrowModel {
  return new YarrowModel(castYarrowHexagram(new SeededRandomSource(seed)));
}

// Per line: 3 rounds × 6 beats + 1 fuse = 19. Plus one trigram pause + reveal.
const EXPECTED_BEATS = 6 * 19 + 1 + 1;

describe("buildYarrowTimeline", () => {
  test("produces a timeline with positive duration", () => {
    const m = model();
    const { timing, detail } = getYarrowTiming("default");
    const { timeline } = buildYarrowTimeline(m, timing, detail);
    expect(new TimelineRunner(timeline).duration).toBeGreaterThan(0);
  });

  test("beatOffsets are monotonic and end at the total duration", () => {
    const m = model();
    const { timing, detail } = getYarrowTiming("default");
    const { timeline, beatOffsets } = buildYarrowTimeline(m, timing, detail);
    expect(beatOffsets).toHaveLength(EXPECTED_BEATS);
    for (let i = 1; i < beatOffsets.length; i++) {
      expect(beatOffsets[i]).toBeGreaterThanOrEqual(beatOffsets[i - 1]);
    }
    expect(beatOffsets[beatOffsets.length - 1]).toBe(
      new TimelineRunner(timeline).duration,
    );
  });

  test("fastForward lands the finished hexagram", () => {
    const m = model(7);
    const { timing, detail } = getYarrowTiming("default");
    const { timeline } = buildYarrowTimeline(m, timing, detail);
    new TimelineRunner(timeline).fastForward(m);

    expect(m.hexagramComplete).toBe(true);
    expect(m.activeLine).toBe(-1);
    expect(m.lines.every((l) => l.settled && l.progress === 1)).toBe(true);
  });

  test("deeper presets yield longer rituals", () => {
    const dur = (preset: "deep" | "default" | "brisk") => {
      const m = model();
      const { timing, detail } = getYarrowTiming(preset);
      return new TimelineRunner(buildYarrowTimeline(m, timing, detail).timeline).duration;
    };
    expect(dur("deep")).toBeGreaterThan(dur("default"));
    expect(dur("default")).toBeGreaterThan(dur("brisk"));
  });

  test("advancing to a round boundary leaves a coherent state", () => {
    const m = model(3);
    const { timing, detail } = getYarrowTiming("default");
    const { timeline, beatOffsets } = buildYarrowTimeline(m, timing, detail);
    const runner = new TimelineRunner(timeline);

    // Beat index 5 is the end of line 0, round 0 (gather..carry).
    runner.advance(beatOffsets[5], m);
    expect(m.activeLine).toBe(0);
    expect(m.fieldCount).toBe(m.transcript[0].rounds[0].remaining);
  });

  test("teach-once: line 0 count is expanded even when the preset is stepped", () => {
    const m = model(2);
    const { timing } = getYarrowTiming("brisk"); // brisk → detail "stepped"
    const { timeline, beatOffsets } = buildYarrowTimeline(m, timing, "stepped");
    const runner = new TimelineRunner(timeline);

    // Line 0, round 0, count beat is index 3; its tween spans [offset2, offset3].
    const line0CountAt25 = beatOffsets[2] + 0.25 * (beatOffsets[3] - beatOffsets[2]);
    runner.advance(line0CountAt25, m);
    const line0Progress = m.countProgress;

    // Line 1, round 0, count beat is index 19 + 3 = 22.
    const line1CountAt25 = beatOffsets[21] + 0.25 * (beatOffsets[22] - beatOffsets[21]);
    runner.advance(line1CountAt25, m);
    const line1Progress = m.countProgress;

    // Line 1 (stepped → linear) tracks raw progress; line 0 (expanded →
    // staircase) quantizes it. They must differ.
    expect(line1Progress).toBeCloseTo(0.25, 5);
    expect(line0Progress).not.toBeCloseTo(0.25, 5);
  });
});
