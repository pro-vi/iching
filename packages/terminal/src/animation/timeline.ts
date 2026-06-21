// Timeline DSL — composable step tree for choreographing animations

import { type EasingFn, linear } from "./easing.ts";

export type Step<Ctx = unknown> =
  | { kind: "wait"; ms: number }
  | { kind: "call"; run: (ctx: Ctx) => unknown }
  | { kind: "tween"; ms: number; easing: EasingFn; apply: (progress: number, ctx: Ctx) => void }
  | { kind: "parallel"; steps: Step<Ctx>[] }
  | { kind: "sequence"; steps: Step<Ctx>[] };

/** Run steps one after another. */
export function seq<Ctx = unknown>(...steps: Step<Ctx>[]): Step<Ctx> {
  return { kind: "sequence", steps };
}

/** Run all steps concurrently; complete when all finish. */
export function par<Ctx = unknown>(...steps: Step<Ctx>[]): Step<Ctx> {
  return { kind: "parallel", steps };
}

/** Idle for the given duration. */
export function wait<Ctx = unknown>(ms: number): Step<Ctx> {
  return { kind: "wait", ms };
}

/**
 * Execute a callback once at the current timeline position. The runner
 * fire-and-forgets the return value, so the type accepts `unknown` —
 * callers can write `call(() => log.push(x))` without wrapping in a block
 * to discard `Array.push`'s number return.
 */
export function call<Ctx = unknown>(fn: (ctx: Ctx) => unknown): Step<Ctx> {
  return { kind: "call", run: fn };
}

/** Animate a value from 0 to 1 over the given duration. */
export function tween<Ctx = unknown>(
  ms: number,
  apply: (progress: number, ctx: Ctx) => void,
  easing: EasingFn = linear,
): Step<Ctx> {
  return { kind: "tween", ms, easing, apply };
}

/** Compute the total duration of a step tree. */
export function stepDuration<Ctx = unknown>(step: Step<Ctx>): number {
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
