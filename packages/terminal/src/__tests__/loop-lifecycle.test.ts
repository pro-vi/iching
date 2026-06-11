// runScene lifecycle guards — persistent-session ownership, resize repaint,
// and the too-small-terminal placeholder.

import { describe, test, expect } from "bun:test";
import type { Clock } from "../clock.ts";
import { ManualClock } from "../clock.ts";
import { runScene, renderTooSmallNotice, MIN_COLS, MIN_ROWS } from "../scene/loop.ts";
import type { Scene, SceneContext } from "../scene/types.ts";
import type { KeyEvent } from "../input/key-parser.ts";
import { CellBuffer } from "../render/buffer.ts";
import { TerminalSession } from "../session/terminal-session.ts";

function mockStdout(columns = 80, rows = 24) {
  const writes: string[] = [];
  return {
    write(data: string) {
      writes.push(data);
      return true;
    },
    columns,
    rows,
    writes,
  };
}

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

/** Scene that exits after `frames` update calls. */
function framesScene(frames: number, hooks?: Partial<Scene>): Scene {
  let count = 0;
  return {
    update(_elapsed, _dt, ctx) {
      count++;
      if (count >= frames) ctx.done = true;
    },
    render() {},
    ...hooks,
  };
}

function rowText(buf: CellBuffer, row: number): string {
  let out = "";
  for (let col = 0; col < buf.width; col++) {
    // Wide chars leave "" continuation cells — concatenating raw chars
    // reconstructs the visible text without phantom gaps.
    out += buf.getCell(row, col).char;
  }
  return out;
}

describe("runScene — session ownership", () => {
  test("standalone run enters and exits the session (one-shot commands)", async () => {
    const stdout = mockStdout();
    const session = new TerminalSession(stdout, mockStdin());
    await runScene(framesScene(1), session, new ManualClock(), "truecolor");
    expect(session.isActive).toBe(false);
    const out = stdout.writes.join("");
    expect(out).toContain("\x1b[?1049h");
    expect(out).toContain("\x1b[?1049l");
  });

  test("an externally-held session stays active across scene runs", async () => {
    const stdout = mockStdout();
    const session = new TerminalSession(stdout, mockStdin());
    session.enter();

    await runScene(framesScene(1), session, new ManualClock(), "truecolor");
    await runScene(framesScene(1), session, new ManualClock(), "truecolor");

    // Neither run left the alt screen — no shell flash between scenes
    expect(session.isActive).toBe(true);
    expect(stdout.writes.join("")).not.toContain("\x1b[?1049l");
    const altOns = stdout.writes.join("").split("\x1b[?1049h").length - 1;
    expect(altOns).toBe(1);

    session.exit();
    expect(stdout.writes.join("")).toContain("\x1b[?1049l");
  });

  test("each scene start clears the screen so stale rows never survive", async () => {
    const stdout = mockStdout();
    const session = new TerminalSession(stdout, mockStdin());
    session.enter();
    const clearsAfterEnter = stdout.writes.join("").split("\x1b[2J").length - 1;

    await runScene(framesScene(1), session, new ManualClock(), "truecolor");

    const clearsAfterScene = stdout.writes.join("").split("\x1b[2J").length - 1;
    expect(clearsAfterScene).toBe(clearsAfterEnter + 1);
    session.exit();
  });
});

describe("runScene — resize repaint", () => {
  test("SIGWINCH invalidates the diff baseline and clears the screen", async () => {
    const stdout = mockStdout();
    const session = new TerminalSession(stdout, mockStdin());
    let frames = 0;
    const dims: Array<{ cols: number; rows: number }> = [];
    const scene: Scene = {
      update(_elapsed, _dt, ctx) {
        frames++;
        if (frames === 2) {
          stdout.columns = 100;
          stdout.rows = 30;
          process.emit("SIGWINCH");
        }
        dims.push({ cols: ctx.cols, rows: ctx.rows });
        if (frames >= 3) ctx.done = true;
      },
      render() {},
    };

    await runScene(scene, session, new ManualClock(), "truecolor");

    // ctx picked up the new dimensions
    expect(dims[2]).toEqual({ cols: 100, rows: 30 });
    // enter() clears once, scene start clears once, resize clears once more
    const clears = stdout.writes.join("").split("\x1b[2J").length - 1;
    expect(clears).toBe(3);
  });
});

/**
 * Clock whose sleep yields to the macrotask queue, so test code can emit
 * stdin data / SIGWINCH between frames while runScene is in flight.
 */
class SteppingClock implements Clock {
  private time = 0;
  now(): number {
    return this.time;
  }
  async sleep(ms: number): Promise<void> {
    this.time += Math.max(1, ms);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/** Let the render loop take a few frames. */
async function frames(n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("runScene — too-small terminal", () => {
  test("below the floor the scene render is replaced by the notice", async () => {
    const stdout = mockStdout(30, 8);
    const session = new TerminalSession(stdout, mockStdin());
    let rendered = false;
    const scene: Scene = {
      update() {},
      render() {
        rendered = true;
      },
    };
    const run = runScene(scene, session, new SteppingClock(), "truecolor");
    await frames(3);
    process.stdin.emit("data", Buffer.from([0x03])); // ctrl-c
    await run;
    expect(rendered).toBe(false);
  });

  test("at or above the floor the scene renders normally", async () => {
    const stdout = mockStdout(MIN_COLS, MIN_ROWS);
    const session = new TerminalSession(stdout, mockStdin());
    let rendered = false;
    const scene = framesScene(1, {
      render() {
        rendered = true;
      },
    });
    await runScene(scene, session, new ManualClock(), "truecolor");
    expect(rendered).toBe(true);
  });

  test("while too small, keys and updates rest — ctrl-c still exits", async () => {
    const stdout = mockStdout(30, 8);
    const session = new TerminalSession(stdout, mockStdin());
    const keys: KeyEvent[] = [];
    let updates = 0;
    const scene: Scene = {
      update() {
        updates++;
      },
      render() {},
      handleKey(key) {
        keys.push(key);
      },
    };

    const run = runScene(scene, session, new SteppingClock(), "truecolor");
    await frames(2);
    process.stdin.emit("data", Buffer.from("j")); // would move a hidden cursor
    await frames(2);
    process.stdin.emit("data", Buffer.from([0x03])); // ctrl-c
    const signal = await run;

    expect(keys).toEqual([]); // the hidden scene never saw a key
    expect(updates).toBe(0); // nor an update tick
    expect(signal).toEqual({ type: "exit" }); // but ctrl-c still exits
  });

  test("resizing back above the floor restores key and update delivery", async () => {
    const stdout = mockStdout(30, 8);
    const session = new TerminalSession(stdout, mockStdin());
    const keys: KeyEvent[] = [];
    let updates = 0;
    const scene: Scene = {
      update() {
        updates++;
      },
      render() {},
      handleKey(key): { type: "back" } | undefined {
        keys.push(key);
        return key.type === "char" && key.char === "q" ? { type: "back" } : undefined;
      },
    };

    const run = runScene(scene, session, new SteppingClock(), "truecolor");
    await frames(2);
    process.stdin.emit("data", Buffer.from("x")); // swallowed while too small
    await frames(2);

    stdout.columns = 80;
    stdout.rows = 24;
    process.emit("SIGWINCH");
    await frames(2);
    process.stdin.emit("data", Buffer.from("q")); // delivered after recovery
    const signal = await run;

    expect(keys).toEqual([{ type: "char", char: "q" }]); // "x" never arrived late
    expect(updates).toBeGreaterThan(0); // updates resumed
    expect(signal).toEqual({ type: "back" });
  });
});

describe("renderTooSmallNotice", () => {
  function ctx(cols: number, rows: number, language?: "en" | "zh-Hant" | "zh-Hans"): SceneContext {
    return { cols, rows, colorSupport: "truecolor", language, done: false };
  }

  test("renders the centered notice and the size floor", () => {
    const frame = CellBuffer.create(38, 10);
    renderTooSmallNotice(frame, ctx(38, 10));
    const all = Array.from({ length: frame.height }, (_, r) => rowText(frame, r)).join("\n");
    expect(all).toContain("the window is too small");
    expect(all).toContain(`${MIN_COLS} × ${MIN_ROWS}`);
  });

  test("localizes the notice", () => {
    const frame = CellBuffer.create(38, 10);
    renderTooSmallNotice(frame, ctx(38, 10, "zh-Hant"));
    const all = Array.from({ length: frame.height }, (_, r) => rowText(frame, r)).join("\n");
    expect(all).toContain("視窗過小");
  });

  test("survives extremely small frames without throwing", () => {
    const frame = CellBuffer.create(4, 2);
    expect(() => renderTooSmallNotice(frame, ctx(4, 2))).not.toThrow();
  });
});
