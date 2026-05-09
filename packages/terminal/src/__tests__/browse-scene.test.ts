import { describe, test, expect } from "bun:test";
import { BrowseScene } from "../scenes/dict/browse-scene.ts";
import type { SceneContext } from "../scene/types.ts";
import { CellBuffer } from "../render/buffer.ts";
import type { KeyEvent } from "../input/key-parser.ts";

function makeCtx(cols = 80, rows = 24): SceneContext {
  return { cols, rows, done: false, colorSupport: "none" as any };
}

describe("BrowseScene", () => {
  test("enter sets viewport height", () => {
    const scene = new BrowseScene();
    const ctx = makeCtx(80, 24);
    scene.enter(ctx);
    // 24 - 2 header - 2 footer = 20
    expect(scene.getModel().viewportHeight).toBe(20);
  });

  test("render does not crash", () => {
    const scene = new BrowseScene();
    const ctx = makeCtx();
    scene.enter(ctx);
    const buf = CellBuffer.create(80, 24);
    scene.render(buf, ctx);
    // Just verify no exception
    expect(true).toBe(true);
  });

  test("arrow down moves cursor", () => {
    const scene = new BrowseScene();
    scene.enter(makeCtx());
    scene.handleKey({ type: "arrow", direction: "down" }, makeCtx());
    expect(scene.getModel().cursor).toBe(1);
  });

  test("enter returns openDetail", () => {
    const scene = new BrowseScene();
    scene.enter(makeCtx());
    const signal = scene.handleKey({ type: "enter" }, makeCtx());
    expect(signal).toEqual({ type: "openDetail", kw: 1 });
  });

  test("enter on second hexagram returns openDetail kw=2", () => {
    const scene = new BrowseScene();
    scene.enter(makeCtx());
    scene.handleKey({ type: "arrow", direction: "down" }, makeCtx());
    const signal = scene.handleKey({ type: "enter" }, makeCtx());
    expect(signal).toEqual({ type: "openDetail", kw: 2 });
  });

  test("q pops back when not in search mode", () => {
    const scene = new BrowseScene();
    const signal = scene.handleKey({ type: "char", char: "q" }, makeCtx());
    expect(signal).toEqual({ type: "back" });
  });

  test("/ activates search mode", () => {
    const scene = new BrowseScene();
    scene.handleKey({ type: "char", char: "/" }, makeCtx());
    expect(scene.getModel().searchActive).toBe(true);
  });

  test("typing filters results", () => {
    const scene = new BrowseScene();
    scene.enter(makeCtx());
    // Type 'c', 'r', 'e' to search for "creative"
    for (const ch of "creative") {
      scene.handleKey({ type: "char", char: ch }, makeCtx());
    }
    expect(scene.getModel().searchActive).toBe(true);
    expect(scene.getModel().filtered.length).toBeGreaterThan(0);
    expect(scene.getModel().filtered[0].ename).toBe("The Creative");
  });

  test("escape clears search", () => {
    const scene = new BrowseScene();
    scene.enter(makeCtx());
    scene.handleKey({ type: "char", char: "/" }, makeCtx());
    scene.handleKey({ type: "char", char: "a" }, makeCtx());
    scene.handleKey({ type: "escape" }, makeCtx());
    expect(scene.getModel().searchActive).toBe(false);
    expect(scene.getModel().filtered).toHaveLength(64);
  });

  test("escape without search returns back", () => {
    const scene = new BrowseScene();
    const signal = scene.handleKey({ type: "escape" }, makeCtx());
    expect(signal).toEqual({ type: "back" });
  });

  test("backspace in search removes character", () => {
    const scene = new BrowseScene();
    scene.enter(makeCtx());
    scene.handleKey({ type: "char", char: "a" }, makeCtx());
    scene.handleKey({ type: "char", char: "b" }, makeCtx());
    scene.handleKey({ type: "backspace" }, makeCtx());
    expect(scene.getModel().query).toBe("a");
  });

  test("page down in list", () => {
    const scene = new BrowseScene();
    scene.enter(makeCtx());
    scene.handleKey({ type: "page", direction: "down" }, makeCtx());
    expect(scene.getModel().cursor).toBe(20);
  });

  test("home goes to first", () => {
    const scene = new BrowseScene();
    scene.enter(makeCtx());
    scene.handleKey({ type: "arrow", direction: "down" }, makeCtx());
    scene.handleKey({ type: "arrow", direction: "down" }, makeCtx());
    scene.handleKey({ type: "home" }, makeCtx());
    expect(scene.getModel().cursor).toBe(0);
  });

  test("end goes to last", () => {
    const scene = new BrowseScene();
    scene.enter(makeCtx());
    scene.handleKey({ type: "end" }, makeCtx());
    expect(scene.getModel().cursor).toBe(63);
  });

  test("renders at 80x24 minimum", () => {
    const scene = new BrowseScene();
    const ctx = makeCtx(80, 24);
    scene.enter(ctx);
    const buf = CellBuffer.create(80, 24);
    scene.render(buf, ctx);
    // Check header row has content
    const headerCell = buf.getCell(0, 1);
    expect(headerCell.char).not.toBe(" ");
  });
});
