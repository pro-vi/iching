// coin-renderer.ts — render 3 coins based on coin phase and progress

import type { CellBuffer } from "../../render/buffer.ts";
import type { StyledCell } from "../../render/cell.ts";
import type { CastModel } from "./model.ts";
import { GLYPHS, LINE_WIDTH } from "../../glyphs.ts";
import { getTheme } from "../../color/theme.ts";
import { getPreset } from "../../animation/presets.ts";

// ── Coin auto preview ─────────────────────────────────────────────────
//
// Looping spin → land → collapse animation for the settings preview.
// Real cast (CastScene) doesn't loop — once a coin lands the line settles
// and the scene moves on. This class exists purely to give settings an
// ambient demo of "what coin auto looks like". Sibling: YarrowAutoPreview
// in scenes/yarrow/yarrow-previews.ts.

/**
 * Self-contained coin animation that loops spin → land → collapse,
 * using the same timing and stagger formula as castOneLine. Settings-
 * preview only — caller passes state to renderCoinSet each frame.
 */
export class CoinAutoPreview {
  phase: "spin" | "land" | "collapse" = "spin";
  progress: [number, number, number] = [0, 0, 0];
  results: [boolean, boolean, boolean];

  private timer = 0;
  private readonly spinMs: number;
  private readonly staggerMs: number;
  private readonly landMs: number;
  private static readonly COLLAPSE_MS = 200;

  constructor() {
    const t = getPreset("default");
    this.spinMs = t.coinFrameMs * 9;
    this.staggerMs = t.coinStaggerMs;
    this.landMs = t.landHoldMs;
    this.results = [Math.random() < 0.5, Math.random() < 0.5, Math.random() < 0.5];
  }

  step(dt: number): void {
    this.timer += dt;
    switch (this.phase) {
      case "spin": {
        const p0 = Math.min(1, this.timer / this.spinMs);
        const p1 = Math.min(1, Math.max(0, (this.timer - this.staggerMs) / (this.spinMs - this.staggerMs)));
        const p2 = Math.min(1, Math.max(0, (this.timer - this.staggerMs * 2) / (this.spinMs - this.staggerMs * 2)));
        this.progress = [p0, p1, p2];
        if (p0 >= 1 && p1 >= 1 && p2 >= 1) {
          this.progress = [1, 1, 1];
          this.phase = "land";
          this.timer = 0;
        }
        break;
      }
      case "land":
        if (this.timer >= this.landMs) {
          this.phase = "collapse";
          this.timer = 0;
          this.progress = [0, 0, 0];
        }
        break;
      case "collapse": {
        const p = Math.min(1, this.timer / CoinAutoPreview.COLLAPSE_MS);
        this.progress = [p, p, p];
        if (p >= 1) {
          this.phase = "spin";
          this.timer = 0;
          this.progress = [0, 0, 0];
          this.results = [Math.random() < 0.5, Math.random() < 0.5, Math.random() < 0.5];
        }
        break;
      }
    }
  }
}

/** Render the 3 coins at the given row, centered in the buffer. */
export function renderCoins(
  buf: CellBuffer,
  model: CastModel,
  row: number,
): void {
  const { coinPhase, coinProgress, coinResults } = model;
  if (coinPhase === "done" || coinPhase === "idle") return;
  const lineLeft = Math.floor((buf.width - LINE_WIDTH) / 2);
  const centerCol = lineLeft + Math.floor(LINE_WIDTH / 2);
  renderCoinSet(buf, centerCol, row, coinPhase, coinProgress, coinResults);
}

/**
 * Render 3 coins at a given center column and row.
 * Usable without a full CastModel — e.g. settings preview.
 */
export function renderCoinSet(
  buf: CellBuffer,
  centerCol: number,
  row: number,
  coinPhase: "spin" | "land" | "collapse",
  coinProgress: [number, number, number],
  coinResults: [boolean, boolean, boolean],
): void {
  const t = getTheme();
  const offsets = [-4, 0, 4];

  for (let i = 0; i < 3; i++) {
    const col = centerCol + offsets[i];
    const p = coinProgress[i];

    let char: string;
    let style: Partial<StyledCell>;

    switch (coinPhase) {
      case "spin": {
        const frameIndex = Math.floor(p * (GLYPHS.coinSpin.length * 2)) % GLYPHS.coinSpin.length;
        char = GLYPHS.coinSpin[frameIndex];
        const fg = p < 0.5 ? t.tertiary : t.secondary;
        style = { fg };
        break;
      }
      case "land": {
        const isHeads = coinResults[i];
        char = isHeads ? GLYPHS.coinHeads : GLYPHS.coinTails;
        style = { fg: t.accent };
        break;
      }
      case "collapse": {
        if (p < 0.5) {
          const isHeads = coinResults[i];
          char = isHeads ? GLYPHS.coinHeads : GLYPHS.coinTails;
          style = { fg: t.secondary, dim: true };
        } else {
          if (i === 1) {
            char = "·";
            style = { fg: t.tertiary };
          } else {
            continue;
          }
        }
        break;
      }
      default:
        continue;
    }

    buf.writeText(row, col, char, style);
  }
}

/**
 * Get the glyph for a coin at a given spin progress.
 * Exported for testing.
 */
export function coinSpinGlyph(progress: number, coinIndex: number): string {
  const frameIndex =
    Math.floor(progress * (GLYPHS.coinSpin.length * 2)) % GLYPHS.coinSpin.length;
  return GLYPHS.coinSpin[frameIndex];
}

/**
 * Get the landed glyph for a coin result.
 * Exported for testing.
 */
export function coinLandGlyph(isHeads: boolean): string {
  return isHeads ? GLYPHS.coinHeads : GLYPHS.coinTails;
}
