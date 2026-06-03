// TossScene — interactive physics coin toss. Space tosses one coin at a time.
// 3 coins per line, 6 lines per hexagram. On complete, hands off to CastScene.

import type { Scene, SceneContext, SceneSignal } from "../../scene/types.ts";
import type { CellBuffer } from "../../render/buffer.ts";
import type { KeyEvent } from "../../input/key-parser.ts";
import {
  castLine, linesToBinary, BINARY_TO_KW, CryptoRandomSource,
  nuclear, polarity, mirror, diagonal,
} from "@iching/core";
import type { Line, Cast } from "@iching/core";
import { getTheme } from "../../color/theme.ts";
import { renderLine } from "../cast/line-renderer.ts";
import { anchorRow, LINE_ROW_OFFSETS } from "../cast/hexagram-renderer.ts";
import {
  formatLineCounter,
  writeChromeHeader,
  writeChromeFooter,
} from "../cast/ritual-chrome.ts";
import { tr } from "../../i18n/messages.ts";
import {
  type CoinState,
  INITIAL_VY,
  COIN_OFFSETS,
  stepCoin,
  coinFrame,
} from "./coin-physics.ts";

const POST_LAND_DELAY = 0.55;
const LINE_DRAW_DURATION = 0.3;

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
  private completedCast: Cast | null = null;

  private get round() { return this.lines.length; }

  private landRow(): number {
    return Math.min(this.rows - 2, anchorRow(this.rows) + 12);
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

    for (let i = 0; i < this.lineProgresses.length; i++) {
      if (this.lineProgresses[i] < 1) {
        this.lineProgresses[i] = Math.min(1, this.lineProgresses[i] + dtSec / LINE_DRAW_DURATION);
      }
    }

    if (this.phase !== "tossing") return;

    let anyFlying = false;
    for (const coin of this.coins) {
      stepCoin(coin, dt);
      if (coin.phase !== "settled") anyFlying = true;
    }

    if (!anyFlying && this.coinsLaunched === 3) {
      if (!this.allSettled) {
        this.allSettled = true;
        this.postLandTimer = 0;
      }
      this.postLandTimer += dtSec;
      if (this.postLandTimer >= POST_LAND_DELAY) this.commitLine();
    }
  }

  render(frame: CellBuffer, ctx: SceneContext): void {
    const t = getTheme();
    const lang = ctx.language ?? "en";
    const h = frame.height;
    const anchor = anchorRow(h);

    if (this.phase === "waiting") {
      // Coin = 1 toss per line, so no sub-counter — formatLineCounter
      // omits it when round.total <= 1.
      writeChromeHeader(frame, formatLineCounter(this.round, 6, undefined, lang));
      writeChromeFooter(frame, `[space] ${tr(lang, "verb.toss")}  ·  [esc] ${tr(lang, "verb.back")}`);
    } else if (this.phase === "complete") {
      writeChromeFooter(frame, `[space] ${tr(lang, "verb.reveal")}  ·  [esc] ${tr(lang, "verb.discard")}`);
    }

    // Physics coins
    for (const coin of this.coins) {
      const row = Math.round(coin.y);
      const col = Math.round(coin.x);
      if (row < 0 || row >= h) continue;
      frame.writeText(row, col, coinFrame(coin), {
        fg: t.primary,
        bold: coin.phase === "settled",
      });
    }

    // Hexagram lines — same vertical position as CastScene
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const lineRow = anchor + LINE_ROW_OFFSETS[i];
      if (lineRow < 0 || lineRow >= h) continue;
      const progress = this.lineProgresses[i] ?? 1;
      const fg = line.isChanging ? t.accent : t.primary;
      renderLine(frame, lineRow, line.isYang, progress, fg, 0, line.isChanging ? "inline" : "gutter");
    }
  }

  handleKey(key: KeyEvent, _ctx: SceneContext): SceneSignal | void {
    if (key.type === "ctrl" && key.char === "c") return { type: "exit" };
    if (key.type === "escape") return { type: "home" };

    if (key.type === "char") {
      if (key.char === "q") return { type: "home" };
      if (key.char === " ") {
        if (this.phase === "complete" && this.completedCast) {
          return { type: "tossCompleted", cast: this.completedCast };
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
    const dx = COIN_OFFSETS[this.coinsLaunched];

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

    if (this.lines.length >= 6) {
      this.phase = "complete";
      this.completedCast = this.buildCast(this.lines);
    } else {
      this.phase = "waiting";
    }
  }

  private buildCast(lines: Line[]): Cast {
    const primaryBinary = linesToBinary(lines);
    const primary = BINARY_TO_KW[primaryBinary];
    const changingPositions: number[] = [];
    let becoming: number | null = null;

    const hasChanging = lines.some(l => l.isChanging);
    if (hasChanging) {
      const bl = lines.map(l => ({ ...l, isYang: l.isChanging ? !l.isYang : l.isYang }));
      becoming = BINARY_TO_KW[linesToBinary(bl)] ?? null;
      lines.forEach((l, i) => { if (l.isChanging) changingPositions.push(i + 1); });
    }

    return {
      lines,
      primary,
      becoming,
      changingPositions,
      nuclear: nuclear(lines),
      polarity: polarity(lines),
      mirror: mirror(lines),
      diagonal: diagonal(lines),
    };
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
