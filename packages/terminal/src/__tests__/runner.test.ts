import { describe, test, expect } from "bun:test";
import { TimelineRunner } from "../animation/runner.ts";
import { seq, par, wait, call, tween } from "../animation/timeline.ts";
import { linear, easeOut } from "../animation/easing.ts";

describe("TimelineRunner", () => {
  test("advance returns false while running, true when complete", () => {
    const runner = new TimelineRunner(wait(100));
    expect(runner.advance(0, {})).toBe(false);
    expect(runner.advance(50, {})).toBe(false);
    expect(runner.advance(100, {})).toBe(true);
    expect(runner.advance(200, {})).toBe(true);
  });

  test("duration is computed correctly", () => {
    const timeline = seq(wait(100), tween(200, () => {}), wait(50));
    const runner = new TimelineRunner(timeline);
    expect(runner.duration).toBe(350);
  });

  test("call executes callback once", () => {
    let count = 0;
    const runner = new TimelineRunner(call(() => { count++; }));
    runner.advance(0, {});
    expect(count).toBe(1);
    // Advancing again should not re-fire
    runner.advance(10, {});
    expect(count).toBe(1);
  });

  test("call in sequence fires at correct time", () => {
    const log: string[] = [];
    const timeline = seq(
      wait(100),
      call(() => log.push("A")),
      wait(100),
      call(() => log.push("B")),
    );
    const runner = new TimelineRunner(timeline);

    runner.advance(50, {});
    expect(log).toEqual([]);

    runner.advance(100, {});
    expect(log).toEqual(["A"]);

    runner.advance(150, {});
    expect(log).toEqual(["A"]);

    runner.advance(200, {});
    expect(log).toEqual(["A", "B"]);
  });

  test("tween calls apply with correct progress (linear)", () => {
    const values: number[] = [];
    const timeline = tween(100, (p) => values.push(p), linear);
    const runner = new TimelineRunner(timeline);

    runner.advance(0, {});
    runner.advance(25, {});
    runner.advance(50, {});
    runner.advance(75, {});
    runner.advance(100, {});

    expect(values[0]).toBeCloseTo(0, 5);
    expect(values[1]).toBeCloseTo(0.25, 5);
    expect(values[2]).toBeCloseTo(0.5, 5);
    expect(values[3]).toBeCloseTo(0.75, 5);
    expect(values[4]).toBeCloseTo(1.0, 5);
  });

  test("tween with easeOut has progress > linear at midpoint", () => {
    let midValue = 0;
    const timeline = tween(100, (p) => { midValue = p; }, easeOut);
    const runner = new TimelineRunner(timeline);

    runner.advance(50, {});
    expect(midValue).toBeGreaterThan(0.5); // easeOut decelerates
  });

  test("tween clamps progress to [0, 1]", () => {
    let lastValue = -1;
    const timeline = tween(100, (p) => { lastValue = p; });
    const runner = new TimelineRunner(timeline);

    runner.advance(200, {}); // overshoot
    expect(lastValue).toBe(1);
  });

  test("sequence runs steps in order", () => {
    const log: string[] = [];
    const timeline = seq(
      call(() => log.push("first")),
      wait(100),
      call(() => log.push("second")),
      wait(100),
      call(() => log.push("third")),
    );
    const runner = new TimelineRunner(timeline);

    runner.advance(0, {});
    expect(log).toEqual(["first"]);

    runner.advance(100, {});
    expect(log).toEqual(["first", "second"]);

    runner.advance(200, {});
    expect(log).toEqual(["first", "second", "third"]);
  });

  test("parallel runs steps concurrently", () => {
    const log: string[] = [];
    const timeline = par(
      seq(call(() => log.push("A-start")), wait(200), call(() => log.push("A-end"))),
      seq(call(() => log.push("B-start")), wait(100), call(() => log.push("B-end"))),
    );
    const runner = new TimelineRunner(timeline);

    runner.advance(0, {});
    expect(log).toEqual(["A-start", "B-start"]);

    runner.advance(100, {});
    expect(log).toEqual(["A-start", "B-start", "B-end"]);

    runner.advance(200, {});
    expect(log).toEqual(["A-start", "B-start", "B-end", "A-end"]);
  });

  test("parallel completes when all steps finish", () => {
    const timeline = par(wait(100), wait(300), wait(200));
    const runner = new TimelineRunner(timeline);

    expect(runner.advance(100, {})).toBe(false);
    expect(runner.advance(200, {})).toBe(false);
    expect(runner.advance(300, {})).toBe(true);
  });

  test("nested seq inside par", () => {
    const values: number[] = [];
    const timeline = par(
      tween(200, (p) => values.push(p)),
      seq(wait(100), tween(100, (p) => values.push(p * 10))),
    );
    const runner = new TimelineRunner(timeline);

    runner.advance(0, {});
    // Tween A starts at 0 with progress 0; seq's tween B hasn't started (wait(100))
    expect(values).toEqual([0]);

    values.length = 0;
    runner.advance(100, {});
    // Tween A at 100/200 = 0.5; Tween B at 0/100 = 0 -> 0*10 = 0
    expect(values[0]).toBeCloseTo(0.5, 5);
    expect(values[1]).toBeCloseTo(0, 5);

    values.length = 0;
    runner.advance(200, {});
    // Tween A at 200/200 = 1; Tween B at 100/100 = 1 -> 1*10 = 10
    expect(values[0]).toBeCloseTo(1, 5);
    expect(values[1]).toBeCloseTo(10, 5);
  });

  test("nested par inside seq", () => {
    const log: string[] = [];
    const timeline = seq(
      call(() => log.push("before")),
      par(
        seq(wait(100), call(() => log.push("A"))),
        seq(wait(200), call(() => log.push("B"))),
      ),
      call(() => log.push("after")),
    );
    const runner = new TimelineRunner(timeline);

    runner.advance(0, {});
    expect(log).toEqual(["before"]);

    runner.advance(100, {});
    expect(log).toEqual(["before", "A"]);

    runner.advance(200, {});
    expect(log).toEqual(["before", "A", "B", "after"]);
  });

  test("reset restores timeline to beginning", () => {
    let count = 0;
    const timeline = seq(
      call(() => { count++; }),
      wait(100),
    );
    const runner = new TimelineRunner(timeline);

    runner.advance(0, {});
    expect(count).toBe(1);

    runner.reset();
    runner.advance(0, {});
    expect(count).toBe(2);
  });

  test("duration computed correctly for nested structures", () => {
    const timeline = seq(
      wait(100),
      par(
        tween(200, () => {}),
        seq(wait(50), tween(300, () => {})),
      ),
      wait(100),
    );
    const runner = new TimelineRunner(timeline);
    // 100 + max(200, 350) + 100 = 550
    expect(runner.duration).toBe(550);
  });

  test("ctx is passed through to callbacks", () => {
    type RunnerCtx = { callFired: boolean; tweenProgress: number };
    const ctx: RunnerCtx = { callFired: false, tweenProgress: -1 };
    const timeline = seq<RunnerCtx>(
      wait<RunnerCtx>(100),
      call((c: RunnerCtx) => { c.callFired = true; }),
      tween(100, (p, c: RunnerCtx) => { c.tweenProgress = p; }),
    );
    const runner = new TimelineRunner(timeline);

    runner.advance(50, ctx);
    expect(ctx.callFired).toBe(false);
    expect(ctx.tweenProgress).toBe(-1);

    runner.advance(100, ctx);
    expect(ctx.callFired).toBe(true);
    expect(ctx.tweenProgress).toBeCloseTo(0, 5);

    runner.advance(150, ctx);
    expect(ctx.tweenProgress).toBeCloseTo(0.5, 5);

    runner.advance(200, ctx);
    expect(ctx.tweenProgress).toBeCloseTo(1, 5);
  });
});
