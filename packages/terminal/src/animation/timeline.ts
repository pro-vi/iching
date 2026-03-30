// Timeline DSL — composable step tree for choreographing animations

import { type EasingFn, linear } from "./easing.ts";

export type Step =
  | { kind: "wait"; ms: number }
  | { kind: "call"; run: (ctx: any) => void | Promise<void> }
  | { kind: "tween"; ms: number; easing: EasingFn; apply: (progress: number, ctx: any) => void }
  | { kind: "parallel"; steps: Step[] }
  | { kind: "sequence"; steps: Step[] };

/** Run steps one after another. */
export function seq(...steps: Step[]): Step {
  return { kind: "sequence", steps };
}

/** Run all steps concurrently; complete when all finish. */
export function par(...steps: Step[]): Step {
  return { kind: "parallel", steps };
}

/** Idle for the given duration. */
export function wait(ms: number): Step {
  return { kind: "wait", ms };
}

/** Execute a callback once at the current timeline position. */
export function call(fn: (ctx: any) => void | Promise<void>): Step {
  return { kind: "call", run: fn };
}

/** Animate a value from 0 to 1 over the given duration. */
export function tween(
  ms: number,
  apply: (progress: number, ctx: any) => void,
  easing: EasingFn = linear,
): Step {
  return { kind: "tween", ms, easing, apply };
}

/** Compute the total duration of a step tree. */
export function stepDuration(step: Step): number {
  switch (step.kind) {
    case "wait":
      return step.ms;
    case "call":
      return 0;
    case "tween":
      return step.ms;
    case "sequence":
      return step.steps.reduce((sum, s) => sum + stepDuration(s), 0);
    case "parallel":
      return Math.max(0, ...step.steps.map(stepDuration));
  }
}
