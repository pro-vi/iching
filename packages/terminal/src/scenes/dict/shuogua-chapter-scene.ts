// ShuoGuaChapterScene — scrollable 說卦傳 chapter reader

import { SHUO_GUA } from "@iching/core";
import type { Scene, SceneContext, SceneSignal } from "../../scene/types.ts";
import type { CellBuffer } from "../../render/buffer.ts";
import type { KeyEvent } from "../../input/key-parser.ts";
import { getTheme } from "../../color/theme.ts";
import { centerPad } from "../../layout/measure.ts";
import { wordWrap } from "./word-wrap.ts";

const FOOTER_ROWS = 2;
const PADDING = 2;

export class ShuoGuaChapterScene implements Scene {
  private readonly chapter: number;
  private readonly text: string;
  private scrollOffset = 0;
  private contentHeight = 0;
  private viewportHeight = 20;

  constructor(chapter: number) {
    this.chapter = Math.min(Math.max(Math.trunc(chapter), 1), SHUO_GUA.chapters.length);
    this.text = SHUO_GUA.chapters[this.chapter - 1]?.text ?? "";
  }

  enter(ctx: SceneContext): void {
    this.viewportHeight = ctx.rows - FOOTER_ROWS;
    this.contentHeight = this.buildLines(ctx.cols).length;
  }

  update(_elapsed: number, _dt: number, _ctx: SceneContext): void {}

  resize(cols: number, rows: number): void {
    this.viewportHeight = rows - FOOTER_ROWS;
    this.contentHeight = this.buildLines(cols).length;
    this.scrollOffset = Math.min(this.scrollOffset, this.maxScroll());
  }

  render(frame: CellBuffer, ctx: SceneContext): void {
    const lines = this.buildLines(ctx.cols);
    this.contentHeight = lines.length;

    const visibleEnd = Math.min(lines.length, this.scrollOffset + this.viewportHeight);
    for (let i = this.scrollOffset; i < visibleEnd; i++) {
      const row = i - this.scrollOffset;
      const line = lines[i];
      frame.writeText(row, PADDING, line.text, {
        fg: line.fg,
        bold: line.bold,
        dim: line.dim,
      });
    }

    this.renderFooter(frame, ctx);
  }

  handleKey(key: KeyEvent, _ctx: SceneContext): SceneSignal | void {
    if (key.type === "char" && key.char === "q") return { type: "back" };
    if (key.type === "ctrl" && key.char === "c") return { type: "exit" };
    if (key.type === "escape" || key.type === "backspace") return { type: "back" };

    if (key.type === "arrow") {
      if (key.direction === "up") this.scrollUp();
      if (key.direction === "down") this.scrollDown();
      return;
    }
    if (key.type === "page") {
      if (key.direction === "up") this.scrollUp(this.viewportHeight);
      if (key.direction === "down") this.scrollDown(this.viewportHeight);
      return;
    }
    if (key.type === "home") {
      this.scrollOffset = 0;
      return;
    }
    if (key.type === "end") {
      this.scrollOffset = this.maxScroll();
    }
  }

  getChapter(): number {
    return this.chapter;
  }

  private scrollUp(n = 1): void {
    this.scrollOffset = Math.max(0, this.scrollOffset - n);
  }

  private scrollDown(n = 1): void {
    this.scrollOffset = Math.min(this.maxScroll(), this.scrollOffset + n);
  }

  private maxScroll(): number {
    return Math.max(0, this.contentHeight - this.viewportHeight);
  }

  private buildLines(width: number): Array<{ text: string; fg?: string; bold?: boolean; dim?: boolean }> {
    const t = getTheme();
    const textWidth = Math.max(1, width - PADDING * 2);
    const lines: Array<{ text: string; fg?: string; bold?: boolean; dim?: boolean }> = [
      { text: centerPad(`說卦傳 ch.${this.chapter}`, textWidth), fg: t.primary, bold: true },
      { text: centerPad("Discussion of the Trigrams", textWidth), fg: t.accent },
      { text: "" },
    ];
    for (const row of wordWrap(this.text, textWidth)) {
      lines.push({ text: row, fg: t.secondary });
    }
    return lines;
  }

  private renderFooter(frame: CellBuffer, ctx: SceneContext): void {
    const t = getTheme();
    const sepRow = ctx.rows - 2;
    const footerRow = ctx.rows - 1;
    frame.writeText(sepRow, 0, "─".repeat(ctx.cols), { fg: t.tertiary });
    frame.writeText(footerRow, 1, "[↑↓] scroll  ·  [esc] back", { fg: t.secondary });

    if (this.contentHeight > this.viewportHeight) {
      const indicator = `${Math.floor(this.scrollOffset / this.viewportHeight) + 1}/${Math.ceil(this.contentHeight / this.viewportHeight)}`;
      frame.writeText(footerRow, ctx.cols - indicator.length - 1, indicator, {
        fg: t.tertiary,
      });
    }
  }
}
