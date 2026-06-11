// Dictionary-as-a-web navigation: the detail view's ←/→ King Wen sequence
// walk (router-replace, no stack growth), tab scrolling the derived links
// into view, browse search prefill, and the browse list polish (trigram pair
// column, quiet empty-search hint).

import { describe, test, expect } from "bun:test";
import { ManualClock } from "../clock.ts";
import { SceneRouter } from "../scene/router.ts";
import type { Scene, SceneContext, SceneSignal } from "../scene/types.ts";
import { TerminalSession } from "../session/terminal-session.ts";
import { CellBuffer } from "../render/buffer.ts";
import { DetailScene } from "../scenes/dict/detail-scene.ts";
import { BrowseScene } from "../scenes/dict/browse-scene.ts";
import { BrowseModel } from "../scenes/dict/browse-model.ts";
import { renderBrowse } from "../scenes/dict/browse-renderer.ts";
import { TextInput } from "../widgets/text-input.ts";

function makeCtx(cols = 80, rows = 24, language?: SceneContext["language"]): SceneContext {
  return { cols, rows, done: false, colorSupport: "none" as never, language };
}

function bufferText(buf: CellBuffer): string {
  return Array.from({ length: buf.height }, (_, row) =>
    buf.getRow(row).map((cell) => cell.char).join(""),
  ).join("\n");
}

// ---------------------------------------------------------------------------
// DetailScene — ←/→ (and h/l) walk the King Wen sequence
// ---------------------------------------------------------------------------
describe("DetailScene sequence walk", () => {
  test("right arrow emits openDetail for KW+1 with replace", () => {
    const scene = new DetailScene(11);
    const signal = scene.handleKey({ type: "arrow", direction: "right" }, makeCtx());
    expect(signal).toEqual({ type: "openDetail", kw: 12, replace: true });
  });

  test("left arrow emits openDetail for KW−1 with replace", () => {
    const scene = new DetailScene(11);
    const signal = scene.handleKey({ type: "arrow", direction: "left" }, makeCtx());
    expect(signal).toEqual({ type: "openDetail", kw: 10, replace: true });
  });

  test("wraps 64 → 1 going forward", () => {
    const scene = new DetailScene(64);
    const signal = scene.handleKey({ type: "arrow", direction: "right" }, makeCtx());
    expect(signal).toEqual({ type: "openDetail", kw: 1, replace: true });
  });

  test("wraps 1 → 64 going back", () => {
    const scene = new DetailScene(1);
    const signal = scene.handleKey({ type: "arrow", direction: "left" }, makeCtx());
    expect(signal).toEqual({ type: "openDetail", kw: 64, replace: true });
  });

  test("h and l mirror left/right", () => {
    const scene = new DetailScene(30);
    expect(scene.handleKey({ type: "char", char: "l" }, makeCtx())).toEqual({
      type: "openDetail",
      kw: 31,
      replace: true,
    });
    expect(scene.handleKey({ type: "char", char: "h" }, makeCtx())).toEqual({
      type: "openDetail",
      kw: 29,
      replace: true,
    });
  });

  test("walk works in derived focus too", () => {
    const scene = new DetailScene(5);
    scene.handleKey({ type: "tab" }, makeCtx());
    const signal = scene.handleKey({ type: "arrow", direction: "right" }, makeCtx());
    expect(signal).toEqual({ type: "openDetail", kw: 6, replace: true });
  });

  test("enter on a derived link still pushes (no replace flag)", () => {
    const scene = new DetailScene(1);
    scene.handleKey({ type: "tab" }, makeCtx());
    const signal = scene.handleKey({ type: "enter" }, makeCtx()) as {
      replace?: boolean;
    };
    expect(signal).toBeDefined();
    expect(signal.replace).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// SceneRouter — openDetail with replace swaps the top scene (esc stays sane)
// ---------------------------------------------------------------------------
function mockStdout(columns = 80, rows = 24) {
  return {
    write(_data: string) {
      return true;
    },
    columns,
    rows,
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

/** Scene that exits (no signal) after one update. */
function quietScene(): Scene {
  return {
    update(_elapsed, _dt, ctx) {
      ctx.done = true;
    },
    render() {},
  };
}

/** Scene that emits `signal` on any key. */
function emitterScene(signal: SceneSignal): Scene {
  return {
    update() {},
    render() {},
    handleKey() {
      return signal;
    },
  };
}

describe("SceneRouter replace-on-openDetail", () => {
  async function runWalk(replace: boolean): Promise<{ router: SceneRouter; next: Scene }> {
    const next = quietScene();
    const first = emitterScene(
      replace
        ? { type: "openDetail", kw: 2, replace: true }
        : { type: "openDetail", kw: 2 },
    );
    const router = new SceneRouter(first, (signal) =>
      signal.type === "openDetail" ? next : null,
    );
    const session = new TerminalSession(
      mockStdout() as never,
      mockStdin(),
    );
    const promise = router.run(session, new ManualClock(), "truecolor");
    // runScene attaches its stdin listener synchronously — feed one key so
    // the first scene emits its openDetail signal.
    process.stdin.emit("data", Buffer.from("x"));
    const result = await promise;
    expect(result.shouldExit).toBe(false);
    return { router, next };
  }

  test("replace: true swaps the top scene — stack stays flat", async () => {
    const { router, next } = await runWalk(true);
    expect(router.current()).toBe(next);
    // pop() refuses on a single-scene stack — proof the walk replaced
    expect(router.pop()).toBeUndefined();
  });

  test("without replace the factory scene is pushed (back unwinds)", async () => {
    const { router, next } = await runWalk(false);
    expect(router.current()).toBe(next);
    expect(router.pop()).toBe(next);
  });
});

// ---------------------------------------------------------------------------
// DetailScene — tab scrolls the derived links into view
// ---------------------------------------------------------------------------
describe("DetailScene derived-focus scrolling", () => {
  test("tab to derived scrolls the selected link into view", () => {
    const scene = new DetailScene(1);
    const ctx = makeCtx();
    scene.enter(ctx);
    const model = scene.getModel();
    expect(model.scrollOffset).toBe(0);
    expect(model.derivedStartLine).toBeGreaterThan(model.viewportHeight);

    scene.handleKey({ type: "tab" }, ctx);
    expect(model.focus).toBe("derived");
    const target = model.derivedStartLine + model.derivedCursor;
    expect(model.scrollOffset).toBeGreaterThan(0);
    expect(target).toBeGreaterThanOrEqual(model.scrollOffset);
    expect(target).toBeLessThan(model.scrollOffset + model.viewportHeight);
  });

  test("derived up/down keeps the selected link visible", () => {
    const scene = new DetailScene(1);
    const ctx = makeCtx();
    scene.enter(ctx);
    const model = scene.getModel();
    scene.handleKey({ type: "tab" }, ctx);
    scene.handleKey({ type: "arrow", direction: "down" }, ctx);
    scene.handleKey({ type: "arrow", direction: "down" }, ctx);
    const target = model.derivedStartLine + model.derivedCursor;
    expect(target).toBeGreaterThanOrEqual(model.scrollOffset);
    expect(target).toBeLessThan(model.scrollOffset + model.viewportHeight);
  });

  test("tab back to content leaves the scroll where it is", () => {
    const scene = new DetailScene(1);
    const ctx = makeCtx();
    scene.enter(ctx);
    const model = scene.getModel();
    scene.handleKey({ type: "tab" }, ctx);
    const offset = model.scrollOffset;
    scene.handleKey({ type: "tab" }, ctx);
    expect(model.focus).toBe("content");
    expect(model.scrollOffset).toBe(offset);
  });
});

// ---------------------------------------------------------------------------
// BrowseScene — search prefill (iching dict <query>)
// ---------------------------------------------------------------------------
describe("BrowseScene initial query", () => {
  test("prefills the search active and filtered", () => {
    const scene = new BrowseScene("fire");
    const model = scene.getModel();
    expect(model.searchActive).toBe(true);
    expect(model.query).toBe("fire");
    expect(model.filtered.length).toBeGreaterThan(0);
    expect(model.filtered.length).toBeLessThan(64);
  });

  test("escape clears the prefilled search back to the full list", () => {
    const scene = new BrowseScene("fire");
    scene.handleKey({ type: "escape" }, makeCtx());
    const model = scene.getModel();
    expect(model.searchActive).toBe(false);
    expect(model.filtered).toHaveLength(64);
  });

  test("backspace edits the prefilled query from its end", () => {
    const scene = new BrowseScene("fire");
    scene.handleKey({ type: "backspace" }, makeCtx());
    expect(scene.getModel().query).toBe("fir");
  });

  test("no query behaves exactly as before", () => {
    const scene = new BrowseScene();
    const model = scene.getModel();
    expect(model.searchActive).toBe(false);
    expect(model.filtered).toHaveLength(64);
  });
});

// ---------------------------------------------------------------------------
// Browse renderer — trigram pair column + quiet empty hint
// ---------------------------------------------------------------------------
describe("Browse renderer polish", () => {
  function renderText(model: BrowseModel, ctx: SceneContext): string {
    const buf = CellBuffer.create(ctx.cols, ctx.rows);
    renderBrowse(buf, model, new TextInput(), ctx);
    return bufferText(buf);
  }

  test("rows carry the trigram pair (upper then lower) where width allows", () => {
    const model = new BrowseModel();
    const text = renderText(model, makeCtx(80, 24, "en"));
    const rows = text.split("\n");
    expect(rows[2]).toContain("☰☰"); // 1 乾 — heaven over heaven
    expect(rows[2]).toContain("The Creative"); // ename column survives
    expect(rows[12]).toContain("☷☰"); // 11 泰 — earth above, heaven below
  });

  test("trigram pair fills the spare right column in Chinese modes", () => {
    const model = new BrowseModel();
    const text = renderText(model, makeCtx(80, 24, "zh-Hant"));
    expect(text).toContain("☰☰");
    expect(text).not.toContain("The Creative");
  });

  test("trigram pair is omitted when the terminal is too narrow", () => {
    const model = new BrowseModel();
    const text = renderText(model, makeCtx(30, 24, "en"));
    expect(text).not.toContain("☰☰");
  });

  test("a no-match search shows the quiet hint instead of a blank list", () => {
    const model = new BrowseModel();
    model.setQuery("zzzzzz");
    expect(model.filtered).toHaveLength(0);
    const text = renderText(model, makeCtx(80, 24, "en"));
    expect(text).toContain("nothing answers");
  });

  test("the empty hint is localized", () => {
    const model = new BrowseModel();
    model.setQuery("zzzzzz");
    const text = renderText(model, makeCtx(80, 24, "zh-Hans"));
    expect(text).toContain("无所应");
    expect(text).not.toContain("nothing answers");
  });
});
