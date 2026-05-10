// Main render loop — 30 FPS with drift compensation

import type { Clock } from "../clock.ts";
import type { Scene, SceneContext, SceneSignal } from "./types.ts";
import type { ColorSupport } from "../color/detect.ts";
import { TerminalSession } from "../session/terminal-session.ts";
import type { KeyEvent } from "../input/key-parser.ts";
import { KeyParser } from "../input/key-parser.ts";
import { CellBuffer } from "../render/buffer.ts";
import { DiffRenderer } from "../render/diff-render.ts";

const TARGET_FPS = 30;
const FRAME_MS = 1000 / TARGET_FPS;
const MAX_DT = 50; // cap dt to avoid large jumps after stalls

/**
 * Run a scene inside a terminal session.
 *
 * 1. Enter alt screen, hide cursor, enable raw mode
 * 2. Call scene.enter()
 * 3. Loop at <=30 FPS with drift compensation
 * 4. Call scene.exit()
 * 5. Restore terminal
 */
export async function runScene(
  scene: Scene,
  session: TerminalSession,
  clock: Clock,
  colorSupport: ColorSupport,
  devMode = false,
): Promise<SceneSignal | void> {
  // Enter alt screen, raw mode, hide cursor
  session.enter();

  let exitSignal: SceneSignal | undefined;

  const ctx: SceneContext = {
    cols: session.cols,
    rows: session.rows,
    colorSupport,
    done: false,
  };

  // Wire up resize (and track for cleanup)
  const onResize = (cols: number, rows: number) => {
    ctx.cols = cols;
    ctx.rows = rows;
    scene.resize?.(cols, rows);
  };
  session.onResize(onResize);

  // Wire up stdin → KeyParser → input queue
  const inputQueue: KeyEvent[] = [];
  const keyParser = new KeyParser((event) => inputQueue.push(event));
  const onData = (chunk: Buffer) => {
    keyParser.feed(new Uint8Array(chunk));
  };
  process.stdin.on("data", onData);

  try {
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
      while (inputQueue.length > 0) {
        const key = inputQueue.shift()!;
        const signal = scene.handleKey?.(key, ctx);
        if (signal) {
          exitSignal = signal;
          ctx.done = true;
          break;
        }
      }
      if (ctx.done) break;

      // Update
      scene.update(elapsed, dt, ctx);

      // Render
      const frame = CellBuffer.create(ctx.cols, ctx.rows);
      scene.render(frame, ctx);
      if (devMode) {
        for (let r = 0; r < frame.height; r++) {
          frame.writeText(r, 0, String(r).padStart(3), { fg: "#444444" });
        }
      }
      renderer.present(prevBuffer, frame);
      prevBuffer = frame;

      // Sleep until next frame target with drift compensation
      const target = start + (Math.floor((now - start) / FRAME_MS) + 1) * FRAME_MS;
      const sleepMs = Math.max(0, target - clock.now());
      await clock.sleep(sleepMs);
    }

    await scene.exit?.(ctx);
  } finally {
    // Always restore terminal + cleanup listeners, even on error
    process.stdin.off("data", onData);
    session.offResize(onResize);
    keyParser.dispose();
    session.exit();
  }

  return exitSignal;
}
