import { describe, test, expect } from "bun:test";
import { TimelineRunner } from "../animation/runner.ts";
import { seq, par, wait, call, tween } from "../animation/timeline.ts";
import { stepDuration } from "../animation/timeline.ts";
import { linear, easeOut, easeInOut } from "../animation/easing.ts";

describe("TimelineRunner.fastForward", () => {
  test("call steps execute in sequence order", () => {
    const log: string[] = [];
    const timeline = seq(
      call(() => log.push("a")),
      wait(1000),
      call(() => log.push("b")),
      wait(500),
      call(() => log.push("c")),
    );

    const runner = new TimelineRunner(timeline);
    runner.fastForward({});

    expect(log).toEqual(["a", "b", "c"]);
  });

  test("tween applies final value (progress=1.0)", () => {
    const model = { x: 0, y: 0 };
    const timeline = seq(
      tween(1000, (p) => { model.x = p * 100; }, linear),
      tween(500, (p) => { model.y = p * 50; }, easeOut),
    );

    const runner = new TimelineRunner(timeline);
    runner.fastForward(model);

    expect(model.x).toBe(100);
    expect(model.y).toBe(50); // easeOut(1) = 1
  });

  test("wait steps are skipped", () => {
    const start = performance.now();
    const model = { done: false };
    const timeline = seq(
      wait(10000), // 10 seconds
      call(() => { model.done = true; }),
    );

    const runner = new TimelineRunner(timeline);
    runner.fastForward(model);

    expect(model.done).toBe(true);
    expect(performance.now() - start).toBeLessThan(50); // instant
  });

  test("parallel executes all branches", () => {
    const model = { a: 0, b: 0, c: false };
    const timeline = par(
      tween(1000, (p) => { model.a = p; }, linear),
      tween(2000, (p) => { model.b = p * 10; }, linear),
      call(() => { model.c = true; }),
    );

    const runner = new TimelineRunner(timeline);
    runner.fastForward(model);

    expect(model.a).toBe(1);
    expect(model.b).toBe(10);
    expect(model.c).toBe(true);
  });

  test("nested seq/par executes correctly", () => {
    const log: number[] = [];
    const timeline = seq(
      call(() => log.push(1)),
      par(
        seq(
          call(() => log.push(2)),
          wait(500),
          call(() => log.push(3)),
        ),
        call(() => log.push(4)),
      ),
      call(() => log.push(5)),
    );

    const runner = new TimelineRunner(timeline);
    runner.fastForward({});

    // All calls should fire: 1, then par(seq(2,3) + 4), then 5
    expect(log).toContain(1);
    expect(log).toContain(2);
    expect(log).toContain(3);
    expect(log).toContain(4);
    expect(log).toContain(5);
    // 1 fires first
    expect(log[0]).toBe(1);
    // 5 fires last
    expect(log[log.length - 1]).toBe(5);
  });

  test("easing is applied to tween final value", () => {
    const model = { val: 0 };
    // easeInOut(1) should be 1
    const timeline = tween(1000, (p) => { model.val = p; }, easeInOut);

    const runner = new TimelineRunner(timeline);
    runner.fastForward(model);

    expect(model.val).toBe(1); // easeInOut(1) = 1
  });

  test("fastForward produces same end state as full advance", () => {
    // Build a representative timeline
    const makeModel = () => ({
      phase: "",
      x: 0,
      y: 0,
      items: [] as string[],
      flag: false,
    });

    const makeTimeline = (m: ReturnType<typeof makeModel>) => seq(
      call(() => { m.phase = "start"; }),
      wait(500),
      tween(1000, (p) => { m.x = p * 100; }, linear),
      call(() => { m.items.push("a"); }),
      par(
        tween(800, (p) => { m.y = p * 50; }, easeOut),
        seq(
          wait(200),
          call(() => { m.items.push("b"); }),
        ),
      ),
      wait(300),
      call(() => { m.phase = "middle"; }),
      tween(500, (p) => { m.x = 100 + p * 50; }, linear),
      call(() => { m.flag = true; m.phase = "end"; }),
    );

    // Path A: advance to completion
    const modelA = makeModel();
    const timelineA = makeTimeline(modelA);
    const runnerA = new TimelineRunner(timelineA);
    const duration = stepDuration(timelineA);
    runnerA.advance(duration + 100, modelA);

    // Path B: fastForward
    const modelB = makeModel();
    const timelineB = makeTimeline(modelB);
    const runnerB = new TimelineRunner(timelineB);
    runnerB.fastForward(modelB);

    // Compare: same end state
    expect(modelB.phase).toBe(modelA.phase);
    expect(modelB.x).toBe(modelA.x);
    expect(modelB.y).toBe(modelA.y);
    expect(modelB.items).toEqual(modelA.items);
    expect(modelB.flag).toBe(modelA.flag);
  });

  test("fastForward on empty sequence is no-op", () => {
    const runner = new TimelineRunner(seq());
    runner.fastForward({}); // should not throw
  });

  test("call with mutable closure works correctly", () => {
    let counter = 0;
    const timeline = seq(
      call(() => { counter++; }),
      wait(1000),
      call(() => { counter *= 10; }),
      wait(500),
      call(() => { counter += 5; }),
    );

    const runner = new TimelineRunner(timeline);
    runner.fastForward({});

    // 0 → 1 → 10 → 15
    expect(counter).toBe(15);
  });
});

describe("CastScene fastForward equivalence", () => {
  test("fastForward matches timeline end state for unchanging cast", async () => {
    const { CastScene } = await import("../scenes/cast/cast-scene.ts");
    const { CastModel } = await import("../scenes/cast/model.ts");

    const cast = {
      lines: [
        { value: 7 as const, isYang: true, isChanging: false },
        { value: 8 as const, isYang: false, isChanging: false },
        { value: 7 as const, isYang: true, isChanging: false },
        { value: 8 as const, isYang: false, isChanging: false },
        { value: 7 as const, isYang: true, isChanging: false },
        { value: 8 as const, isYang: false, isChanging: false },
      ],
      primary: 63,
      becoming: null,
      changingPositions: [] as number[],
      nuclear: 64,
      polarity: 64,
      mirror: 64,
      diagonal: 63,
    };

    // Path A: run to completion
    const sceneA = new CastScene(cast, "reduced", 80);
    const ctxA = { cols: 80, rows: 24, done: false, colorSupport: "none" as const };
    sceneA.enter(ctxA);
    const durationA = sceneA.getTimeline().duration;
    sceneA.update(durationA + 1000, 33, ctxA);
    const modelA = sceneA.getModel();

    // Path B: fastForward
    const sceneB = new CastScene(cast, "reduced", 80);
    sceneB.skipToComplete();
    const modelB = sceneB.getModel();

    // Compare key fields
    expect(modelB.hexagramComplete).toBe(modelA.hexagramComplete);
    expect(modelB.showPrompt).toBe(modelA.showPrompt);
    expect(modelB.titleProgress).toBe(modelA.titleProgress);
    expect(modelB.focusedHex).toBe(modelA.focusedHex);
    expect(modelB.explorationMode).toBe(modelA.explorationMode);
    for (let i = 0; i < 6; i++) {
      expect(modelB.lines[i].progress).toBe(1);
      expect(modelB.lines[i].settled).toBe(true);
    }
  });

  test("fastForward matches timeline end state for changing cast", async () => {
    const { CastScene } = await import("../scenes/cast/cast-scene.ts");

    const cast = {
      lines: [
        { value: 9 as const, isYang: true, isChanging: true },
        { value: 8 as const, isYang: false, isChanging: false },
        { value: 7 as const, isYang: true, isChanging: false },
        { value: 6 as const, isYang: false, isChanging: true },
        { value: 7 as const, isYang: true, isChanging: false },
        { value: 8 as const, isYang: false, isChanging: false },
      ],
      primary: 21,
      becoming: 42,
      changingPositions: [1, 4],
      nuclear: 39,
      polarity: 48,
      mirror: 22,
      diagonal: 47,
    };

    // Path A: run to completion
    const sceneA = new CastScene(cast, "reduced", 80);
    const ctxA = { cols: 80, rows: 24, done: false, colorSupport: "none" as const };
    sceneA.enter(ctxA);
    const durationA = sceneA.getTimeline().duration;
    sceneA.update(durationA + 1000, 33, ctxA);
    const modelA = sceneA.getModel();

    // Path B: fastForward
    const sceneB = new CastScene(cast, "reduced", 80);
    sceneB.skipToComplete();
    const modelB = sceneB.getModel();

    // Compare key fields — all should match except focusedHex
    expect(modelB.hexagramComplete).toBe(modelA.hexagramComplete);
    expect(modelB.showPrompt).toBe(modelA.showPrompt);
    expect(modelB.titleProgress).toBe(modelA.titleProgress);
    expect(modelB.explorationMode).toBe(modelA.explorationMode);
    expect(modelB.layout).toBe(modelA.layout);
    expect(modelB.splitProgress).toBe(modelA.splitProgress);
    expect(modelB.becomingTitleProgress).toBe(modelA.becomingTitleProgress);
    // Re-entry lands on primary (intentional divergence from timeline end state)
    expect(modelA.focusedHex).toBe("becoming"); // timeline ends here
    expect(modelB.focusedHex).toBe("primary");  // re-entry overrides to primary
  });
});
