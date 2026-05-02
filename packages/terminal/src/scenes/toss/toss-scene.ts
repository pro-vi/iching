// TossScene — interactive physics coin toss playground (dev mode)
// Space tosses one coin at a time. 3 coins resolve a line. 6 lines build a hexagram.

import type { Scene, SceneContext, SceneSignal } from "../../scene/types.ts";
import type { CellBuffer } from "../../render/buffer.ts";
import type { KeyEvent } from "../../input/key-parser.ts";
import { castLine, linesToBinary, BINARY_TO_KW, GUA, CryptoRandomSource } from "@iching/core";
import type { Line } from "@iching/core";
import { getTheme } from "../../color/theme.ts";
import { stringWidth } from "../../layout/measure.ts";
import { GLYPHS } from "../../glyphs.ts";

// Physics constants (rows/cols per second)
const GRAVITY = 55;
const INITIAL_VY = -22;
const BOUNCE_DECAY = 0.42;
const MAX_BOUNCES = 1;
const FLIP_RATE = 9;
const POST_LAND_DELAY = 0.55;
const LINE_DRAW_DURATION = 0.3;

const FLIP_FRAMES = ["◉", "◑", "│", "◐", "○", "◐", "│", "◑"];
const SPIN_FRAMES = ["◉", "◑", "◐", "○", "◐", "◑"];
const COIN_HALF = 0;

// Final static line strings (━, 15 cols)
const FINAL_YANG     = "━━━━━━━━━━━━━━━";
const FINAL_YIN      = "━━━━━━   ━━━━━━";
const FINAL_CHG_YANG = "━━━━━━ ● ━━━━━━";
const FINAL_CHG_YIN  = "━━━━━━ ○ ━━━━━━";
const LINE_HALF = 7;

interface CoinState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  flipAngle: number;
  result: boolean;
  phase: "flying" | "bouncing" | "spinning" | "settled";
  bounces: number;
  landY: number;
  spinRate: number;
  spinDecay: number;
}

type ScenePhase = "waiting" | "tossing" | "complete";

export class TossScene implements Scene {
  private lines: Line[] = [];
  private lineProgresses: number[] = [];
  private coins: CoinState[] = [];
  private phase: ScenePhase = "waiting";
  private postLandTimer = 0;
  private allSettled = false;
  private rows = 24;
  private cols = 80;
  private _pendingLine: Line | null = null;
  private coinsLaunched = 0;
  private pendingResults: [boolean, boolean, boolean] | null = null;

  private get round() { return this.lines.length; }

  private landRow(): number {
    return Math.max(5, this.rows - 19);
  }

  enter(ctx: SceneContext): void {
    this.rows = ctx.rows;
    this.cols = ctx.cols;
  }

  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
  }

  update(_elapsed: number, dt: number, _ctx: SceneContext): void {
    const dtSec = dt / 1000;

    // Advance line draw animations (all phases)
    for (let i = 0; i < this.lineProgresses.length; i++) {
      if (this.lineProgresses[i] < 1) {
        this.lineProgresses[i] = Math.min(1, this.lineProgresses[i] + dtSec / LINE_DRAW_DURATION);
      }
    }

    if (this.phase !== "tossing") return;

    let anyFlying = false;

    for (const coin of this.coins) {
      if (coin.phase === "settled") continue;

      if (coin.phase === "spinning") {
        coin.flipAngle += coin.spinRate * dtSec * Math.PI * 2;
        coin.spinRate *= Math.pow(coin.spinDecay, dt / 16.67);
        if (coin.spinRate < 0.5) {
          coin.phase = "settled";
        } else {
          anyFlying = true;
        }
        continue;
      }

      coin.vy += GRAVITY * dtSec;
      coin.x += coin.vx * dtSec;
      coin.y += coin.vy * dtSec;
      coin.flipAngle += FLIP_RATE * dtSec * Math.PI * 2;

      if (coin.y >= coin.landY) {
        coin.y = coin.landY;
        if (coin.bounces < MAX_BOUNCES && Math.abs(coin.vy) > 3) {
          coin.phase = "bouncing";
          coin.vy *= -BOUNCE_DECAY;
          coin.vx *= 0.6;
          coin.bounces++;
          anyFlying = true;
        } else {
          const longSpin = Math.random() < 0.35;
          coin.phase = "spinning";
          coin.spinRate = FLIP_RATE * (0.45 + Math.random() * 0.2);
          coin.spinDecay = longSpin ? 0.97 : 0.85;
          coin.vy = 0;
          coin.vx = 0;
          anyFlying = true;
        }
      } else {
        anyFlying = true;
      }
    }

    // Only resolve once all 3 coins are launched and settled
    if (!anyFlying && this.coinsLaunched === 3) {
      if (!this.allSettled) {
        this.allSettled = true;
        this.postLandTimer = 0;
      }
      this.postLandTimer += dtSec;
      if (this.postLandTimer >= POST_LAND_DELAY) this.commitLine();
    }
  }

  render(frame: CellBuffer, _ctx: SceneContext): void {
    const t = getTheme();
    const cx = Math.floor(frame.width / 2);
    const h = frame.height;

    if (this.phase === "waiting") {
      const label = `Round ${this.round + 1} / 6`;
      const hint = "[space] toss  •  [q] quit";
      frame.writeText(2, cx - Math.floor(stringWidth(label) / 2), label, { fg: t.secondary });
      frame.writeText(4, cx - Math.floor(stringWidth(hint) / 2), hint, { fg: t.tertiary, dim: true });
    } else if (this.phase === "complete") {
      this.renderComplete(frame, cx);
    }

    // Coins
    for (const coin of this.coins) {
      const row = Math.round(coin.y);
      const col = Math.round(coin.x) - COIN_HALF;
      if (row < 0 || row >= h) continue;

      if (coin.phase === "settled") {
        const char = coin.result ? "◉" : "○";
        frame.writeText(row, col, char, { fg: t.primary, bold: true });
      } else {
        const frames = coin.phase === "spinning" ? SPIN_FRAMES : FLIP_FRAMES;
        const frameIdx = Math.floor(
          ((coin.flipAngle % (Math.PI * 2)) / (Math.PI * 2)) * frames.length
        ) % frames.length;
        frame.writeText(row, col, frames[frameIdx], { fg: t.primary });
      }
    }

    // Hexagram lines — animated draw-in
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const lineRow = h - 2 - i * 2;
      const progress = this.lineProgresses[i] ?? 1;
      const fg = line.isChanging ? t.accent : t.primary;
      let lineStr: string;
      if (progress >= 1) {
        lineStr = line.isChanging
          ? (line.isYang ? FINAL_CHG_YANG : FINAL_CHG_YIN)
          : (line.isYang ? FINAL_YANG : FINAL_YIN);
      } else {
        const frames = line.isYang ? GLYPHS.yangFrames : GLYPHS.yinFrames;
        const idx = Math.min(frames.length - 1, Math.floor(progress * frames.length));
        lineStr = frames[idx];
      }
      frame.writeText(lineRow, cx - LINE_HALF, lineStr, { fg, bold: line.isChanging });
    }
  }

  private renderComplete(frame: CellBuffer, cx: number): void {
    const t = getTheme();
    const binary = linesToBinary(this.lines);
    const kw = BINARY_TO_KW[binary];
    const gua = kw ? GUA[kw - 1] : null;

    if (gua) {
      const title = `${gua.u}  ${gua.n}`;
      const subtitle = `Hexagram ${kw}  ·  ${gua.p}`;
      frame.writeText(2, cx - Math.floor(stringWidth(title) / 2), title, { fg: t.accent, bold: true });
      frame.writeText(3, cx - Math.floor(stringWidth(subtitle) / 2), subtitle, { fg: t.secondary });
    }

    const hint = "[space] new cast  •  [q] quit";
    frame.writeText(5, cx - Math.floor(stringWidth(hint) / 2), hint, { fg: t.tertiary, dim: true });
  }

  handleKey(key: KeyEvent, _ctx: SceneContext): SceneSignal | void {
    if (key.type === "ctrl" && key.char === "c") return "exit";
    if (key.type === "escape") return { goto: "home" };

    if (key.type === "char") {
      if (key.char === "q") return { goto: "home" };
      if (key.char === " ") {
        if (this.phase === "complete") {
          this.reset();
        } else if (this.coinsLaunched < 3) {
          this.launchCoin();
        }
      }
    }
  }

  private launchCoin(): void {
    if (this.coinsLaunched >= 3) return;

    if (this.coinsLaunched === 0) {
      const source = new CryptoRandomSource();
      const line = castLine(source);
      this._pendingLine = line;
      this.pendingResults = this.lineValueToCoins(line.value);
      this.phase = "tossing";
      this.allSettled = false;
      this.postLandTimer = 0;
    }

    const cx = Math.floor(this.cols / 2);
    const landY = this.landRow();
    const offsets = [-5, 0, 5];
    const dx = offsets[this.coinsLaunched];

    this.coins.push({
      x: cx + dx + (Math.random() - 0.5),
      y: landY - 1,
      vx: dx * 0.4 + (Math.random() - 0.5) * 1.5,
      vy: INITIAL_VY + (Math.random() - 0.5) * 6,
      flipAngle: this.coinsLaunched * (Math.PI * 2 / 3),
      result: this.pendingResults![this.coinsLaunched],
      phase: "flying" as const,
      bounces: 0,
      landY,
      spinRate: 0,
      spinDecay: 0.9,
    });

    this.coinsLaunched++;
  }

  private commitLine(): void {
    if (this._pendingLine) {
      this.lines.push(this._pendingLine);
      this.lineProgresses.push(0);
      this._pendingLine = null;
    }
    this.coins = [];
    this.coinsLaunched = 0;
    this.pendingResults = null;
    this.allSettled = false;
    this.postLandTimer = 0;
    this.phase = this.lines.length >= 6 ? "complete" : "waiting";
  }

  private reset(): void {
    this.lines = [];
    this.lineProgresses = [];
    this.coins = [];
    this._pendingLine = null;
    this.coinsLaunched = 0;
    this.pendingResults = null;
    this.phase = "waiting";
    this.allSettled = false;
    this.postLandTimer = 0;
  }

  private lineValueToCoins(value: number): [boolean, boolean, boolean] {
    const headsCount = value - 6;
    const coins: boolean[] = [false, false, false];
    for (let i = 0; i < headsCount; i++) coins[i] = true;
    for (let i = 2; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [coins[i], coins[j]] = [coins[j], coins[i]];
    }
    return coins as [boolean, boolean, boolean];
  }
}
