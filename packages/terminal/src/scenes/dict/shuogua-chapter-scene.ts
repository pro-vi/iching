// ShuoGuaChapterScene — scrollable 說卦傳 chapter reader

import {
  SHUO_GUA,
  TRIGRAMS,
  TRIGRAM_ASSOC_GLOSS_EN,
  type DerivedType,
} from "@iching/core";
import type { Scene, SceneContext, SceneSignal } from "../../scene/types.ts";
import type { CellBuffer } from "../../render/buffer.ts";
import type { KeyEvent } from "../../input/key-parser.ts";
import { getTheme } from "../../color/theme.ts";
import { centerPad } from "../../layout/measure.ts";
import { wordWrap } from "./word-wrap.ts";

const FOOTER_ROWS = 2;
const PADDING = 2;
const TRIGRAM_ORDER = ["乾", "坤", "震", "巽", "坎", "離", "艮", "兌"] as const;

type ContentLine = { text: string; fg?: string; bold?: boolean; dim?: boolean };
type Theme = ReturnType<typeof getTheme>;

export class ShuoGuaChapterScene implements Scene {
  private readonly chapter: number;
  private readonly op?: DerivedType;
  private scrollOffset = 0;
  private contentHeight = 0;
  private viewportHeight = 20;

  constructor(chapter: number, op?: DerivedType) {
    this.chapter = Math.min(Math.max(Math.trunc(chapter), 1), SHUO_GUA.chapters.length);
    this.op = op;
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

  getOp(): DerivedType | undefined {
    return this.op;
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

  private buildLines(width: number): ContentLine[] {
    const t = getTheme();
    const textWidth = Math.max(1, width - PADDING * 2);
    const chapter = SHUO_GUA.chapters[this.chapter - 1];
    const lines: ContentLine[] = [
      { text: centerPad(`說卦傳 ch.${this.chapter}`, textWidth), fg: t.primary, bold: true },
      { text: centerPad("Discussion of the Trigrams", textWidth), fg: t.accent },
      { text: "" },
    ];

    this.addSection(lines, textWidth, t, "Canonical", chapter?.text ?? "", { fg: t.secondary });
    this.addSection(lines, textWidth, t, "Working translation", chapter?.modernEn ?? "", {
      fg: t.secondary,
      dim: true,
    });
    this.addTrigramTable(lines, textWidth, t);

    return lines;
  }

  private addSection(
    lines: ContentLine[],
    textWidth: number,
    t: Theme,
    label: string,
    text: string,
    style: Omit<ContentLine, "text">,
  ): void {
    if (!text) return;
    lines.push({ text: label, fg: t.accent, bold: true });
    for (const row of wordWrap(text, textWidth)) {
      lines.push({ text: row, ...style });
    }
    lines.push({ text: "" });
  }

  private addTrigramTable(lines: ContentLine[], textWidth: number, t: Theme): void {
    const tableRows = this.trigramTableRows();
    if (tableRows.length === 0) return;

    lines.push({ text: "Trigram table", fg: t.accent, bold: true });
    lines.push({ text: "Project glosses in English; canonical fields remain Chinese.", fg: t.tertiary, dim: true });
    for (const row of tableRows) {
      for (const wrapped of wordWrap(row, textWidth)) {
        lines.push({ text: wrapped, fg: t.secondary });
      }
    }
    lines.push({ text: "" });
  }

  private trigramTableRows(): string[] {
    if (![5, 7, 8, 9, 10, 11].includes(this.chapter)) return [];

    return TRIGRAM_ORDER.map((name) => {
      const trigram = TRIGRAMS.find((t) => t.n === name);
      const assoc = trigram?.assoc;
      const gloss = TRIGRAM_ASSOC_GLOSS_EN[name];
      const prefix = `${trigram?.sym ?? ""} ${name}`;

      if (!assoc || !gloss) return prefix;

      switch (this.chapter) {
        case 5:
          return `${prefix}  ${assoc.direction} / ${gloss.direction}  ${assoc.cosmologicalRole ?? ""}`.trim();
        case 7:
          return `${prefix}  ${assoc.attribute} / ${gloss.attribute}`;
        case 8:
          return `${prefix}  ${assoc.animal} / ${gloss.animal}`;
        case 9:
          return `${prefix}  ${assoc.body} / ${gloss.body}`;
        case 10:
          return `${prefix}  ${assoc.family} / ${gloss.family}`;
        case 11:
          return `${prefix}  ${assoc.extendedImages.join(" ")}`;
        default:
          return prefix;
      }
    });
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
