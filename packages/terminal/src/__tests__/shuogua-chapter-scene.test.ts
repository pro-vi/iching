import { describe, test, expect } from "bun:test";
import { ShuoGuaChapterScene } from "../scenes/dict/shuogua-chapter-scene.ts";
import { CellBuffer } from "../render/buffer.ts";
import type { SceneContext } from "../scene/types.ts";

function makeCtx(cols = 80, rows = 24): SceneContext {
  return { cols, rows, done: false, colorSupport: "none" as any };
}

describe("ShuoGuaChapterScene", () => {
  test("constructs for a cited chapter", () => {
    const scene = new ShuoGuaChapterScene(3);
    expect(scene.getChapter()).toBe(3);
  });

  test("clamps invalid chapter numbers to the available 說卦 range", () => {
    expect(new ShuoGuaChapterScene(0).getChapter()).toBe(1);
    expect(new ShuoGuaChapterScene(99).getChapter()).toBe(11);
  });

  test("render does not crash", () => {
    const scene = new ShuoGuaChapterScene(6);
    const ctx = makeCtx();
    scene.enter(ctx);
    scene.render(CellBuffer.create(80, 24), ctx);
    expect(true).toBe(true);
  });

  test("escape and q return back", () => {
    const scene = new ShuoGuaChapterScene(2);
    expect(scene.handleKey({ type: "escape" }, makeCtx())).toEqual({ type: "back" });
    expect(scene.handleKey({ type: "char", char: "q" }, makeCtx())).toEqual({ type: "back" });
  });
});
