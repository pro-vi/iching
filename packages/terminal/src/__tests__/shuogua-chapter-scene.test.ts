import { describe, test, expect } from "bun:test";
import { ShuoGuaChapterScene } from "../scenes/dict/shuogua-chapter-scene.ts";
import { CellBuffer } from "../render/buffer.ts";
import type { SceneContext } from "../scene/types.ts";

function makeCtx(cols = 80, rows = 24): SceneContext {
  return { cols, rows, done: false, colorSupport: "none" as any };
}

function bufferText(buf: CellBuffer): string {
  return Array.from({ length: buf.height }, (_, row) =>
    buf.getRow(row).map((cell) => cell.char).join(""),
  ).join("\n");
}

describe("ShuoGuaChapterScene", () => {
  test("constructs for a cited chapter", () => {
    const scene = new ShuoGuaChapterScene(3);
    expect(scene.getChapter()).toBe(3);
  });

  test("preserves the selected derivation op", () => {
    const scene = new ShuoGuaChapterScene(3, "nuclear");
    expect(scene.getOp()).toBe("nuclear");
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

  test("renders canonical text and working translation without interpretive derivation notes", () => {
    const scene = new ShuoGuaChapterScene(3, "nuclear");
    const ctx = makeCtx(96, 40);
    const buf = CellBuffer.create(ctx.cols, ctx.rows);
    scene.enter(ctx);
    scene.render(buf, ctx);
    const text = bufferText(buf);
    expect(text).toContain("Canonical");
    expect(text).toContain("天地定位");
    expect(text).toContain("Working translation");
    expect(text).toContain("Heaven and earth settle their positions");
    expect(text).not.toContain("Why this citation matters");
    expect(text).not.toContain("inner line structure");
  });

  test("renders trigram table rows for catalogue chapters", () => {
    const scene = new ShuoGuaChapterScene(7, "becoming");
    const ctx = makeCtx(96, 40);
    const buf = CellBuffer.create(ctx.cols, ctx.rows);
    scene.enter(ctx);
    scene.render(buf, ctx);
    const text = bufferText(buf);
    expect(text).toContain("Trigram table");
    expect(text).toContain("☰ 乾 健 / strength");
    expect(text).toContain("☱ 兌 說 / joy");
  });

  test("escape and q return back", () => {
    const scene = new ShuoGuaChapterScene(2);
    expect(scene.handleKey({ type: "escape" }, makeCtx())).toEqual({ type: "back" });
    expect(scene.handleKey({ type: "char", char: "q" }, makeCtx())).toEqual({ type: "back" });
  });
});
