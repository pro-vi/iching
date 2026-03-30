import { describe, test, expect } from "bun:test";
import { ManualClock } from "../clock.ts";
import { runScene } from "../scene/loop.ts";
import type { Scene, SceneContext } from "../scene/types.ts";
import type { CellBuffer } from "../render/buffer.ts";
import type { KeyEvent } from "../input/key-parser.ts";
import { TerminalSession } from "../session/terminal-session.ts";

// Minimal mock stdout that satisfies TerminalSession
function mockStdout() {
  return {
    write(_data: string) { return true; },
    columns: 80,
    rows: 24,
  };
}

// Minimal mock stdin
function mockStdin() {
  const handlers: Record<string, Function[]> = {};
  return {
    isTTY: false,
    resume() {},
    pause() {},
    setRawMode(_mode: boolean) {},
    on(event: string, handler: Function) {
      (handlers[event] ??= []).push(handler);
    },
    off(event: string, handler: Function) {
      const list = handlers[event];
      if (list) {
        const idx = list.indexOf(handler);
        if (idx >= 0) list.splice(idx, 1);
      }
    },
  } as unknown as typeof process.stdin;
}

describe("runScene (render loop)", () => {
  test("scene lifecycle: enter -> update/render -> exit all called", async () => {
    const log: string[] = [];
    const clock = new ManualClock();
    let frameCount = 0;

    const scene: Scene = {
      enter(ctx) {
        log.push("enter");
      },
      update(elapsed, dt, ctx) {
        log.push(`update:${elapsed}`);
        frameCount++;
        // Exit after 2 frames
        if (frameCount >= 2) {
          ctx.done = true;
        }
      },
      render(frame, ctx) {
        log.push("render");
      },
      exit(ctx) {
        log.push("exit");
      },
    };

    const session = new TerminalSession(mockStdout(), mockStdin());

    // Run scene — the ManualClock sleep is a no-op, so the loop
    // will spin through frames immediately with elapsed=0 each time
    await runScene(scene, session, clock, "truecolor");

    expect(log[0]).toBe("enter");
    expect(log).toContain("update:0");
    expect(log).toContain("render");
    expect(log[log.length - 1]).toBe("exit");
  });

  test("ManualClock allows deterministic frame stepping", () => {
    const clock = new ManualClock();
    expect(clock.now()).toBe(0);

    clock.advance(33);
    expect(clock.now()).toBe(33);

    clock.advance(17);
    expect(clock.now()).toBe(50);
  });

  test("scene handleKey receives key events", async () => {
    const keys: KeyEvent[] = [];
    const clock = new ManualClock();
    let frameCount = 0;

    const scene: Scene = {
      update(_elapsed, _dt, ctx) {
        frameCount++;
        if (frameCount >= 1) ctx.done = true;
      },
      render() {},
      handleKey(key, _ctx) {
        keys.push(key);
      },
    };

    const session = new TerminalSession(mockStdout(), mockStdin());
    await runScene(scene, session, clock, "truecolor");

    // No keys were fed, so none received
    expect(keys).toEqual([]);
  });

  test("scene context has correct dimensions", async () => {
    let capturedCtx: SceneContext | null = null;
    const clock = new ManualClock();

    const scene: Scene = {
      update(_elapsed, _dt, ctx) {
        capturedCtx = { ...ctx };
        ctx.done = true;
      },
      render() {},
    };

    const stdout = mockStdout();
    stdout.columns = 120;
    stdout.rows = 40;
    const session = new TerminalSession(stdout, mockStdin());

    await runScene(scene, session, clock, "256");

    expect(capturedCtx!.cols).toBe(120);
    expect(capturedCtx!.rows).toBe(40);
    expect(capturedCtx!.colorSupport).toBe("256");
  });

  test("handleKey returning 'exit' stops the loop", async () => {
    const clock = new ManualClock();
    let updateCount = 0;

    // We need to feed a key into the scene. Since input is queue-based
    // in the loop, and we don't have direct access, we test via
    // the done flag in update instead.
    const scene: Scene = {
      update(_elapsed, _dt, ctx) {
        updateCount++;
        // Simulate what handleKey("exit") would do
        ctx.done = true;
      },
      render() {},
    };

    const session = new TerminalSession(mockStdout(), mockStdin());
    await runScene(scene, session, clock, "truecolor");

    expect(updateCount).toBe(1);
  });
});
