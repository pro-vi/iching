// Main render loop — 30 FPS with drift compensation

import type { Clock } from "../clock.ts";
import type { Scene, SceneContext, SceneSignal } from "./types.ts";
import type { ColorSupport } from "../color/detect.ts";
import type { TerminalSession } from "../session/terminal-session.ts";
import type { KeyEvent } from "../input/key-parser.ts";
import { CellBuffer } from "../render/buffer.ts";
import { DiffRenderer } from "../render/diff-render.ts";

const TARGET_FPS = 30;
const FRAME_MS = 1000 / TARGET_FPS;
const MAX_DT = 50; // cap dt to avoid large jumps after stalls

/**
 * Run a scene inside a terminal session.
 *
 * The loop:
 * 1. Create SceneContext from session dimensions
 * 2. Call scene.enter()
 * 3. Loop at <=30 FPS with drift compensation
 * 4. Call scene.exit()
 */
export async function runScene(
  scene: Scene,
  session: TerminalSession,
  clock: Clock,
  colorSupport: ColorSupport,
): Promise<void> {
  const ctx: SceneContext = {
    cols: session.cols,
    rows: session.rows,
    done: false,
    colorSupport,
  };

  // Wire up resize
  const onResize = (cols: number, rows: number) => {
    ctx.cols = cols;
    ctx.rows = rows;
    scene.resize?.(cols, rows);
  };
  session.onResize(onResize);

  // Wire up input queue
  const inputQueue: KeyEvent[] = [];
  const inputCleanup = setupInput(session, inputQueue);

  // Create diff renderer
  const renderer = new DiffRenderer(undefined, colorSupport);

  await scene.enter?.(ctx);

  const start = clock.now();
  let prev = start;
  let prevBuffer = CellBuffer.create(ctx.cols, ctx.rows);

  while (!ctx.done) {
    const now = clock.now();
    const elapsed = now - start;
    const dt = Math.min(now - prev, MAX_DT);
    prev = now;

    // Drain input queue
    drainInput(scene, ctx, inputQueue);

    // If input signaled exit, break
    if (ctx.done) break;

    // Update
    scene.update(elapsed, dt, ctx);

    // Render
    const frame = CellBuffer.create(ctx.cols, ctx.rows);
    scene.render(frame, ctx);
    renderer.present(prevBuffer, frame);
    prevBuffer = frame;

    // Sleep until next frame target with drift compensation
    const target = start + (Math.floor((now - start) / FRAME_MS) + 1) * FRAME_MS;
    const sleepMs = Math.max(0, target - clock.now());
    await clock.sleep(sleepMs);
  }

  await scene.exit?.(ctx);
  inputCleanup();
}

/** Drain all pending key events into the scene. */
function drainInput(
  scene: Scene,
  ctx: SceneContext,
  queue: KeyEvent[],
): void {
  while (queue.length > 0) {
    const key = queue.shift()!;
    const signal = scene.handleKey?.(key, ctx);
    if (signal === "exit") {
      ctx.done = true;
      return;
    }
  }
}

/** Set up input reading. Returns cleanup function. */
function setupInput(
  _session: TerminalSession,
  queue: KeyEvent[],
): () => void {
  // The session's stdin is in raw mode. We read keys via the
  // raw-input module in production. For testability, scenes
  // can also push keys into the queue directly.
  //
  // In a real session, TerminalSession would wire stdin → KeyParser → queue.
  // For now we expose the queue pattern; wiring happens at the call-site.
  return () => {
    queue.length = 0;
  };
}
