// Main render loop — 30 FPS with drift compensation

import type { Clock } from "../clock.ts";
import type { Scene, SceneContext, SceneSignal } from "./types.ts";
import type { ColorSupport } from "../color/detect.ts";
import type { DisplayLanguage } from "@iching/core";
import { TerminalSession } from "../session/terminal-session.ts";
import type { KeyEvent } from "../input/key-parser.ts";
import { KeyParser } from "../input/key-parser.ts";
import { CellBuffer } from "../render/buffer.ts";
import { DiffRenderer } from "../render/diff-render.ts";
import { getTheme } from "../color/theme.ts";
import { stringWidth } from "../layout/measure.ts";
import { tr } from "../i18n/messages.ts";

const TARGET_FPS = 30;
const FRAME_MS = 1000 / TARGET_FPS;
const MAX_DT = 50; // cap dt to avoid large jumps after stalls

// Minimum terminal size for honest scene layout. Below this, scenes silently
// clip (CellBuffer no-ops out-of-bounds writes), so the loop renders a calm
// placeholder instead.
export const MIN_COLS = 40;
export const MIN_ROWS = 12;

/**
 * Render the centered too-small notice into a frame. Exported for tests.
 */
export function renderTooSmallNotice(frame: CellBuffer, ctx: SceneContext): void {
  const t = getTheme();
  const lang = ctx.language ?? "en";
  const msg = tr(lang, "notice.tooSmall");
  const dims = `${MIN_COLS} × ${MIN_ROWS}`;
  const msgRow = Math.max(0, Math.floor(frame.height / 2) - 1);
  frame.writeText(msgRow, Math.max(0, Math.floor((frame.width - stringWidth(msg)) / 2)), msg, {
    fg: t.secondary,
  });
  frame.writeText(msgRow + 2, Math.max(0, Math.floor((frame.width - stringWidth(dims)) / 2)), dims, {
    fg: t.tertiary,
    dim: true,
  });
}

/**
 * Run a scene inside a terminal session.
 *
 * 1. Enter alt screen, hide cursor, enable raw mode — unless an outer owner
 *    (e.g. the interactive home loop) already holds the session, in which
 *    case the screen is cleared in place so transitions never flash the shell
 * 2. Call scene.enter()
 * 3. Loop at <=30 FPS with drift compensation
 * 4. Call scene.exit()
 * 5. Restore terminal (only when this call entered the session)
 */
export async function runScene(
  scene: Scene,
  session: TerminalSession,
  clock: Clock,
  colorSupport: ColorSupport,
  devMode = false,
  language: DisplayLanguage = "en",
): Promise<SceneSignal | void> {
  // Ownership: enter only if no outer holder is active; exit symmetrically.
  const ownsSession = !session.isActive;
  if (ownsSession) session.enter();

  let exitSignal: SceneSignal | undefined;

  const ctx: SceneContext = {
    cols: session.cols,
    rows: session.rows,
    colorSupport,
    language,
    done: false,
  };

  // Wire up resize (and track for cleanup). The terminal rewraps alt-screen
  // content on resize, so the next frame must be a full clear + repaint.
  let needsRepaint = false;
  const onResize = (cols: number, rows: number) => {
    ctx.cols = cols;
    ctx.rows = rows;
    scene.resize?.(cols, rows);
    needsRepaint = true;
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

    // Wipe any rows left by the previous scene — under a persistent session
    // there is no enter()-time clear between scenes.
    session.clear();

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

      // Render — below the size floor, show the calm placeholder instead of
      // silently clipped scene content.
      const frame = CellBuffer.create(ctx.cols, ctx.rows);
      if (ctx.cols < MIN_COLS || ctx.rows < MIN_ROWS) {
        renderTooSmallNotice(frame, ctx);
      } else {
        scene.render(frame, ctx);
        if (devMode) {
          for (let r = 0; r < frame.height; r++) {
            frame.writeText(r, 0, String(r).padStart(3), { fg: "#444444" });
          }
        }
      }

      // After a resize, invalidate the diff baseline and clear the screen so
      // this frame is a full repaint (stale rewrapped rows never survive).
      if (needsRepaint) {
        needsRepaint = false;
        session.clear();
        prevBuffer = CellBuffer.create(ctx.cols, ctx.rows);
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
    if (ownsSession) session.exit();
  }

  return exitSignal;
}
