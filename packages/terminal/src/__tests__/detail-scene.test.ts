import { describe, test, expect } from "bun:test";
import { DetailScene } from "../scenes/dict/detail-scene.ts";
import { CellBuffer } from "../render/buffer.ts";
import type { SceneContext } from "../scene/types.ts";

function makeCtx(cols = 80, rows = 24): SceneContext {
  return { cols, rows, done: false, colorSupport: "none" as any };
}

describe("DetailScene", () => {
  test("constructs for hexagram 1", () => {
    const scene = new DetailScene(1);
    expect(scene.getModel().detail.kw).toBe(1);
    expect(scene.getModel().detail.gua.ename).toBe("The Creative");
  });

  test("render does not crash", () => {
    const scene = new DetailScene(1);
    const ctx = makeCtx();
    scene.enter(ctx);
    const buf = CellBuffer.create(80, 24);
    scene.render(buf, ctx);
    expect(true).toBe(true);
  });

  test("escape returns back", () => {
    const scene = new DetailScene(1);
    const signal = scene.handleKey({ type: "escape" }, makeCtx());
    expect(signal).toEqual({ type: "back" });
  });

  test("backspace returns back", () => {
    const scene = new DetailScene(1);
    const signal = scene.handleKey({ type: "backspace" }, makeCtx());
    expect(signal).toEqual({ type: "back" });
  });

  test("q exits", () => {
    const scene = new DetailScene(1);
    const signal = scene.handleKey({ type: "char", char: "q" }, makeCtx());
    expect(signal).toEqual({ type: "exit" });
  });

  test("tab toggles focus", () => {
    const scene = new DetailScene(1);
    expect(scene.getModel().focus).toBe("content");
    scene.handleKey({ type: "tab" }, makeCtx());
    expect(scene.getModel().focus).toBe("derived");
    scene.handleKey({ type: "tab" }, makeCtx());
    expect(scene.getModel().focus).toBe("content");
  });

  test("arrow down in content scrolls", () => {
    const scene = new DetailScene(1);
    scene.enter(makeCtx());
    // Build content first by rendering
    scene.render(CellBuffer.create(80, 24), makeCtx());
    scene.handleKey({ type: "arrow", direction: "down" }, makeCtx());
    expect(scene.getModel().scrollOffset).toBe(1);
  });

  test("arrow down in derived moves cursor", () => {
    const scene = new DetailScene(1);
    scene.handleKey({ type: "tab" }, makeCtx()); // focus derived
    scene.handleKey({ type: "arrow", direction: "down" }, makeCtx());
    expect(scene.getModel().derivedCursor).toBe(1);
  });

  test("enter on derived navigates", () => {
    const scene = new DetailScene(1);
    scene.handleKey({ type: "tab" }, makeCtx()); // focus derived
    const signal = scene.handleKey({ type: "enter" }, makeCtx());
    expect(signal).toBeDefined();
    expect(typeof signal).toBe("object");
    const result = signal as { type: string; kw?: number };
    expect(result.type).toBe("openDetail");
    expect(typeof result.kw).toBe("number");
    expect(result.kw).toBeGreaterThanOrEqual(1);
    expect(result.kw).toBeLessThanOrEqual(64);
  });

  test("setHistory updates model", () => {
    const scene = new DetailScene(1);
    scene.setHistory(3, "2026-03-28");
    expect(scene.getModel().castCount).toBe(3);
    expect(scene.getModel().lastCastDate).toBe("2026-03-28");
  });

  test("derived links populated correctly", () => {
    const scene = new DetailScene(1);
    const links = scene.getModel().derivedLinks;
    expect(links).toHaveLength(4);
    expect(links[0].label).toBe("Nuclear");
    expect(links[1].label).toBe("Polarity");
    expect(links[2].label).toBe("Mirror");
    expect(links[3].label).toBe("Diagonal");
  });

  test("renders all 64 hexagrams without crash", () => {
    for (let kw = 1; kw <= 64; kw++) {
      const scene = new DetailScene(kw);
      const ctx = makeCtx();
      scene.enter(ctx);
      const buf = CellBuffer.create(80, 24);
      scene.render(buf, ctx);
    }
    expect(true).toBe(true);
  });
});
