// TimelineRunner — executes a Step tree against elapsed time

import { type Step, stepDuration } from "./timeline.ts";

/**
 * Evaluates a Step tree against elapsed time.
 * Pure: given the same Step and elapsed, produces identical side-effects on ctx.
 */
export class TimelineRunner {
  private root: Step;
  private totalDuration: number;
  private state: StepState;
  private lastElapsed = 0;

  constructor(root: Step) {
    this.root = root;
    this.totalDuration = stepDuration(root);
    this.state = createState(root);
  }

  /** Total duration of the timeline in ms. */
  get duration(): number {
    return this.totalDuration;
  }

  /**
   * Advance timeline to the given elapsed time (ms since start).
   * Calls apply/run callbacks as the timeline progresses.
   * Returns true when the timeline is complete.
   */
  advance(elapsed: number, ctx: any): boolean {
    advanceStep(this.root, this.state, elapsed, 0, ctx);
    this.lastElapsed = elapsed;
    return elapsed >= this.totalDuration;
  }

  /** Reset timeline to the beginning. */
  reset(): void {
    this.state = createState(this.root);
    this.lastElapsed = 0;
  }
}

// --- Internal state tracking ---

type StepState =
  | { kind: "wait" }
  | { kind: "call"; fired: boolean }
  | { kind: "tween"; lastProgress: number }
  | { kind: "parallel"; children: StepState[] }
  | { kind: "sequence"; children: StepState[] };

function createState(step: Step): StepState {
  switch (step.kind) {
    case "wait":
      return { kind: "wait" };
    case "call":
      return { kind: "call", fired: false };
    case "tween":
      return { kind: "tween", lastProgress: -1 };
    case "parallel":
      return { kind: "parallel", children: step.steps.map(createState) };
    case "sequence":
      return { kind: "sequence", children: step.steps.map(createState) };
  }
}

/**
 * Advance a single step. `elapsed` is absolute time, `offset` is when this step starts.
 * Returns the duration consumed by this step.
 */
function advanceStep(
  step: Step,
  state: StepState,
  elapsed: number,
  offset: number,
  ctx: any,
): void {
  const local = elapsed - offset;

  switch (step.kind) {
    case "wait":
      // Nothing to do — just consumes time
      break;

    case "call": {
      const s = state as { kind: "call"; fired: boolean };
      if (!s.fired && local >= 0) {
        s.fired = true;
        step.run(ctx);
      }
      break;
    }

    case "tween": {
      const s = state as { kind: "tween"; lastProgress: number };
      if (local >= 0) {
        const raw = step.ms <= 0 ? 1 : Math.min(1, Math.max(0, local / step.ms));
        const eased = step.easing(raw);
        // Always apply — even if same progress (idempotent)
        step.apply(eased, ctx);
        s.lastProgress = eased;
      }
      break;
    }

    case "parallel": {
      const s = state as { kind: "parallel"; children: StepState[] };
      for (let i = 0; i < step.steps.length; i++) {
        advanceStep(step.steps[i], s.children[i], elapsed, offset, ctx);
      }
      break;
    }

    case "sequence": {
      const s = state as { kind: "sequence"; children: StepState[] };
      let cursor = offset;
      for (let i = 0; i < step.steps.length; i++) {
        const child = step.steps[i];
        advanceStep(child, s.children[i], elapsed, cursor, ctx);
        cursor += stepDuration(child);
      }
      break;
    }
  }
}
