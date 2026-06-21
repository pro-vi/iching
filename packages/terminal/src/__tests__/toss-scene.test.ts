import { describe, test, expect } from "bun:test";
import { sceneCtx } from "../testing.ts";
import { TossScene } from "../scenes/toss/toss-scene.ts";
import { anchorRow } from "../scenes/cast/hexagram-renderer.ts";
import { CellBuffer } from "../render/buffer.ts";

/** The row that used to hold the casting-surface line (one below the landing). */
function formerGroundRow(rows: number): number {
  return Math.min(rows - 2, anchorRow(rows) + 12) + 1;
}

/** Coin animation glyphs (FLIP_FRAMES ∪ SPIN_FRAMES ∪ settled). */
const COIN_GLYPHS = new Set(["◉", "◑", "│", "◐", "○"]);

describe("TossScene minimal surface", () => {
  test("draws no ground/surface line — the coins toss in open space", () => {
    const scene = new TossScene();
    const ctx = sceneCtx(80, 24, "truecolor");
    scene.enter(ctx);

    const frame = new CellBuffer(80, 24);
    scene.render(frame, ctx);

    // The former ground row is empty across its whole width — no "─" surface
    // span (the line was removed for a quieter, more minimal toss).
    const row = formerGroundRow(24);
    for (let c = 0; c < 80; c++) {
      expect(frame.getCell(row, c).char).not.toBe("─");
    }
  });

  test("no surface line appears at any point through a coin's flight", () => {
    const scene = new TossScene();
    const ctx = sceneCtx(80, 24, "truecolor");
    scene.enter(ctx);
    scene.handleKey({ type: "char", char: " " }, ctx); // launch first coin

    const row = formerGroundRow(24);
    for (let ms = 16; ms <= 6000; ms += 16) {
      scene.update(ms, 16, ctx);
      const frame = new CellBuffer(80, 24);
      scene.render(frame, ctx);
      for (let c = 0; c < 80; c++) {
        expect(frame.getCell(row, c).char).not.toBe("─");
      }
    }
  });

  test("a launched coin still renders (the bounce physics are kept)", () => {
    const scene = new TossScene();
    const ctx = sceneCtx(80, 24, "truecolor");
    scene.enter(ctx);
    scene.handleKey({ type: "char", char: " " }, ctx); // launch first coin

    // Step the physics a few frames and confirm a coin glyph is drawn — the
    // toss animation is intact; only the ground line was removed.
    let sawCoin = false;
    for (let ms = 16; ms <= 600 && !sawCoin; ms += 16) {
      scene.update(ms, 16, ctx);
      const frame = new CellBuffer(80, 24);
      scene.render(frame, ctx);
      for (let r = 0; r < 24 && !sawCoin; r++) {
        for (let c = 0; c < 80; c++) {
          if (COIN_GLYPHS.has(frame.getCell(r, c).char)) {
            sawCoin = true;
            break;
          }
        }
      }
    }
    expect(sawCoin).toBe(true);
  });
});
