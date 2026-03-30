import { describe, test, expect } from "bun:test";
import { seq, par, wait, call, tween, stepDuration } from "../animation/timeline.ts";
import { linear, easeOut } from "../animation/easing.ts";

describe("timeline DSL", () => {
  test("wait() creates a wait step", () => {
    const s = wait(100);
    expect(s.kind).toBe("wait");
    expect((s as any).ms).toBe(100);
  });

  test("call() creates a call step", () => {
    const fn = () => {};
    const s = call(fn);
    expect(s.kind).toBe("call");
    expect((s as any).run).toBe(fn);
  });

  test("tween() creates a tween step with default linear easing", () => {
    const apply = () => {};
    const s = tween(200, apply);
    expect(s.kind).toBe("tween");
    expect((s as any).ms).toBe(200);
    expect((s as any).easing).toBe(linear);
  });

  test("tween() accepts custom easing", () => {
    const s = tween(200, () => {}, easeOut);
    expect((s as any).easing).toBe(easeOut);
  });

  test("seq() creates a sequence step", () => {
    const s = seq(wait(100), wait(200));
    expect(s.kind).toBe("sequence");
    expect((s as any).steps).toHaveLength(2);
  });

  test("par() creates a parallel step", () => {
    const s = par(wait(100), wait(200));
    expect(s.kind).toBe("parallel");
    expect((s as any).steps).toHaveLength(2);
  });

  describe("stepDuration", () => {
    test("wait duration", () => {
      expect(stepDuration(wait(100))).toBe(100);
    });

    test("call duration is 0", () => {
      expect(stepDuration(call(() => {}))).toBe(0);
    });

    test("tween duration", () => {
      expect(stepDuration(tween(300, () => {}))).toBe(300);
    });

    test("sequence duration is sum of children", () => {
      expect(stepDuration(seq(wait(100), wait(200), wait(300)))).toBe(600);
    });

    test("parallel duration is max of children", () => {
      expect(stepDuration(par(wait(100), wait(300), wait(200)))).toBe(300);
    });

    test("nested seq/par duration", () => {
      const timeline = seq(
        wait(100),
        par(
          tween(200, () => {}),
          seq(wait(50), tween(300, () => {})),
        ),
        wait(100),
      );
      // seq: 100 + par(200, 50+300=350) + 100 = 100 + 350 + 100 = 550
      expect(stepDuration(timeline)).toBe(550);
    });

    test("empty sequence has 0 duration", () => {
      expect(stepDuration(seq())).toBe(0);
    });

    test("empty parallel has 0 duration", () => {
      expect(stepDuration(par())).toBe(0);
    });
  });
});
