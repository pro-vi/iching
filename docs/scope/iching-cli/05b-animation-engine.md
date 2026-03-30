# 05b: Animation Engine

## Summary

Build the animation timeline DSL (sequence/parallel/wait/tween/call), scene lifecycle manager, motion presets, and the main render loop. This is the choreography layer between the terminal primitives and the casting scenes.

## Design

### Module structure

```
packages/terminal/src/
├─ animation/
│  ├─ timeline.ts               # Step type + seq/parallel/wait/tween/call builders
│  ├─ runner.ts                 # TimelineRunner: execute a Step tree against a clock
│  ├─ easing.ts                 # easeInOut, easeOut, linear — Robert Penner equations
│  └─ presets.ts                # motion presets: default, brisk, deep, reduced
├─ scene/
│  ├─ types.ts                  # Scene interface (enter/update/render/handleKey/resize/exit)
│  └─ loop.ts                   # main render loop: 30 FPS, Bun.sleep, drift compensation
├─ clock.ts                     # Clock interface (now(), sleep()) — injectable for tests
```

### Timeline DSL

```typescript
type Step =
  | { kind: "wait"; ms: number }
  | { kind: "call"; run: (ctx: SceneContext) => void | Promise<void> }
  | { kind: "tween"; ms: number; easing: EasingFn; apply: (progress: number, ctx: SceneContext) => void }
  | { kind: "parallel"; steps: Step[] }
  | { kind: "sequence"; steps: Step[] };

// Builders
function seq(...steps: Step[]): Step;
function par(...steps: Step[]): Step;
function wait(ms: number): Step;
function call(fn: (ctx: SceneContext) => void): Step;
function tween(ms: number, apply: (p: number, ctx: SceneContext) => void, easing?: EasingFn): Step;
```

Example — one cast line:

```typescript
const castOneLine = (lineIndex: number) => seq(
  wait(RITUAL.timing.preTossMs),                              // pre-breath
  par(                                                         // coin spin (staggered)
    tween(680, (p, ctx) => ctx.coinSpin(0, p)),
    seq(wait(60), tween(620, (p, ctx) => ctx.coinSpin(1, p))),
    seq(wait(120), tween(560, (p, ctx) => ctx.coinSpin(2, p))),
  ),
  wait(RITUAL.timing.landHoldMs),                             // hold on landed coins
  call((ctx) => ctx.collapseCoins(lineIndex)),                // coins → center dot
  tween(RITUAL.timing.lineDrawMs, (p, ctx) =>                // line draws center-out
    ctx.drawLine(lineIndex, p)
  ),
  call((ctx) => ctx.commitLine(lineIndex)),                   // finalize line
  wait(RITUAL.timing.restMs),                                  // rest
);
```

### Scene interface

```typescript
interface Scene {
  enter?(ctx: SceneContext): void | Promise<void>;
  update(elapsed: number, dt: number, ctx: SceneContext): void;
  render(frame: CellBuffer, ctx: SceneContext): void;
  handleKey?(key: KeyEvent, ctx: SceneContext): SceneSignal | void;
  resize?(cols: number, rows: number): void;
  exit?(ctx: SceneContext): void | Promise<void>;
}

type SceneSignal = "continue" | "exit" | { goto: string };
```

### TimelineRunner

Evaluates a Step tree against elapsed time. Pure — given the same `Step` and `elapsed`, produces the same side effects on `SceneContext`.

```typescript
class TimelineRunner {
  constructor(root: Step, ctx: SceneContext);
  advance(elapsed: number): boolean;  // returns true when complete
}
```

### Main render loop

```typescript
async function runScene(scene: Scene, session: TerminalSession, clock: Clock) {
  const ctx = createSceneContext(session);
  await scene.enter?.(ctx);

  const FPS = 30;
  const frameMs = 1000 / FPS;
  const start = clock.now();
  let prev = start;
  let prevBuffer = CellBuffer.create(ctx.cols, ctx.rows);

  while (!ctx.done) {
    const now = clock.now();
    const elapsed = now - start;
    const dt = Math.min(now - prev, 50);
    prev = now;

    drainInputQueue(scene, ctx);
    scene.update(elapsed, dt, ctx);

    const frame = CellBuffer.create(ctx.cols, ctx.rows);
    scene.render(frame, ctx);
    diffRenderer.present(prevBuffer, frame);
    prevBuffer = frame;

    const target = start + (Math.floor((now - start) / frameMs) + 1) * frameMs;
    await clock.sleep(Math.max(0, target - clock.now()));
  }

  await scene.exit?.(ctx);
}
```

### Motion presets

```typescript
const PRESETS = {
  default: { frameBase: 80, totalCast: "20-24s" },
  brisk:   { frameBase: 55, totalCast: "14-16s" },
  deep:    { frameBase: 95, totalCast: "28-32s" },
  reduced: { frameBase: 80, noSpin: true, noGlow: true, instantMorph: true },
};
```

Reduced motion: same ritual structure (pauses preserved), but coin outcomes appear directly, lines draw in one frame, morph is a single crossfade. Same soul, less movement.

### Clock injection

```typescript
interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

// Production
const realClock: Clock = {
  now: () => performance.now(),
  sleep: (ms) => Bun.sleep(ms),
};

// Tests — manual advance
class ManualClock implements Clock {
  private time = 0;
  now() { return this.time; }
  async sleep() {}
  advance(ms: number) { this.time += ms; }
}
```

## Scope

### Files

- All files listed in module structure above
- `packages/terminal/src/__tests__/timeline.test.ts`
- `packages/terminal/src/__tests__/runner.test.ts`
- `packages/terminal/src/__tests__/easing.test.ts`
- `packages/terminal/src/__tests__/loop.test.ts`

### Acceptance criteria

- [ ] `seq()` executes steps in order, each starting after the previous completes
- [ ] `par()` executes steps concurrently, completes when all finish
- [ ] `wait()` holds for the specified duration
- [ ] `tween()` calls apply() with progress 0→1 over duration, using specified easing
- [ ] `call()` executes the callback once at the current timeline position
- [ ] Nested seq/par combinations work correctly (seq inside par, par inside seq)
- [ ] TimelineRunner.advance() returns false while running, true when complete
- [ ] TimelineRunner produces identical ctx mutations for identical elapsed values (deterministic)
- [ ] ManualClock allows frame-by-frame testing without real time
- [ ] Main loop runs at ≤30 FPS with drift compensation
- [ ] Main loop handles SIGWINCH resize by calling scene.resize()
- [ ] Main loop drains input queue before each update
- [ ] Scene lifecycle: enter → update/render loop → exit all called correctly
- [ ] Scene.handleKey returns SceneSignal to control flow (continue, exit, goto)
- [ ] Motion presets modify timing values correctly
- [ ] Reduced motion: no spin frames, no glow, instant morph — but pauses preserved
- [ ] Easing functions: linear at 0=0, 0.5≈0.5, 1=1; easeOut decelerates; easeInOut S-curves
- [ ] Timeline snapshots at known timestamps match expected state (keyframe testing)

### Dependencies

- Depends on [05a-terminal-primitives](05a-terminal-primitives.md)

### Estimate

~600 LOC (source) + ~400 LOC (tests)
