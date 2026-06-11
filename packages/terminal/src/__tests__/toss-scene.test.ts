import { describe, test, expect } from "bun:test";
import { TossScene } from "../scenes/toss/toss-scene.ts";
import { anchorRow } from "../scenes/cast/hexagram-renderer.ts";
import { CellBuffer } from "../render/buffer.ts";
import { getTheme } from "../color/theme.ts";
import type { SceneContext } from "../scene/types.ts";

function makeCtx(cols = 80, rows = 24): SceneContext {
  return { cols, rows, done: false, colorSupport: "truecolor" };
}

/** Same landing-row derivation as TossScene.landRow(). */
function groundRow(rows: number): number {
  return Math.min(rows - 2, anchorRow(rows) + 12) + 1;
}

describe("TossScene ground", () => {
  test("renders a dim tertiary ground line under the landing row", () => {
    const t = getTheme();
    const scene = new TossScene();
    const ctx = makeCtx();
    scene.enter(ctx);

    const frame = new CellBuffer(80, 24);
    scene.render(frame, ctx);

    const row = groundRow(24);
    const center = frame.getCell(row, 40);
    expect(center.char).toBe("─");
    expect(center.fg).toBe(t.tertiary);
    expect(center.dim).toBe(true);
  });

  test("ground line is a centered span, not full width", () => {
    const scene = new TossScene();
    const ctx = makeCtx();
    scene.enter(ctx);

    const frame = new CellBuffer(80, 24);
    scene.render(frame, ctx);

    const row = groundRow(24);
    expect(frame.getCell(row, 2).char).toBe(" ");
    expect(frame.getCell(row, 77).char).toBe(" ");
  });

  test("a coin touchdown briefly brightens the ground at the impact column", () => {
    const t = getTheme();
    const scene = new TossScene();
    const ctx = makeCtx();
    scene.enter(ctx);

    // Launch the first coin, then step physics frame by frame.
    scene.handleKey({ type: "char", char: " " }, ctx);

    const row = groundRow(24);
    let flashed = false;
    for (let ms = 16; ms <= 6000 && !flashed; ms += 16) {
      scene.update(ms, 16, ctx);
      const frame = new CellBuffer(80, 24);
      scene.render(frame, ctx);
      for (let c = 0; c < 80; c++) {
        const cell = frame.getCell(row, c);
        if (cell.char === "─" && cell.fg !== t.tertiary) {
          flashed = true;
          break;
        }
      }
    }
    expect(flashed).toBe(true);
  });

  test("the flash fades back to the base ground color", () => {
    const t = getTheme();
    const scene = new TossScene();
    const ctx = makeCtx();
    scene.enter(ctx);
    scene.handleKey({ type: "char", char: " " }, ctx);

    // Run well past any landing + flash window (flash is 0.35s).
    for (let ms = 16; ms <= 8000; ms += 16) {
      scene.update(ms, 16, ctx);
    }
    const frame = new CellBuffer(80, 24);
    scene.render(frame, ctx);

    const row = groundRow(24);
    for (let c = 0; c < 80; c++) {
      const cell = frame.getCell(row, c);
      if (cell.char === "─") {
        expect(cell.fg).toBe(t.tertiary);
      }
    }
  });
});
