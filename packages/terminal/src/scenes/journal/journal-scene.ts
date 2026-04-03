// JournalScene — scrollable timeline of past readings

import type { Scene, SceneContext, SceneSignal } from "../../scene/types.ts";
import type { CellBuffer } from "../../render/buffer.ts";
import type { KeyEvent } from "../../input/key-parser.ts";
import type { HistoryEntry } from "@iching/core";
import { GUA, buildStructure } from "@iching/core";
import { getTheme } from "../../color/theme.ts";
import { stringWidth } from "../../layout/measure.ts";
import { ScrollableRegion } from "../../widgets/scrollable.ts";

export class JournalScene implements Scene {
  private entries: HistoryEntry[];
  private cursor: number;
  private scroll: ScrollableRegion;

  constructor(entries: HistoryEntry[]) {
    // Most recent first
    this.entries = [...entries].reverse();
    this.cursor = 0;
    this.scroll = new ScrollableRegion(20, []);
  }

  enter(ctx: SceneContext): void {
    this.scroll.viewportHeight = ctx.rows - 5; // header + footer
  }

  update(_elapsed: number, _dt: number, _ctx: SceneContext): void {}

  resize(cols: number, rows: number): void {
    this.scroll.viewportHeight = rows - 5;
  }

  render(frame: CellBuffer, ctx: SceneContext): void {
    const t = getTheme();
    const maxW = ctx.cols;

    // Header
    const title = "Journal";
    const titleCol = Math.max(0, Math.floor((maxW - stringWidth(title)) / 2));
    frame.writeText(0, titleCol, title, { fg: t.primary, bold: true });

    const countText = `${this.entries.length} readings`;
    frame.writeText(0, maxW - stringWidth(countText) - 1, countText, { fg: t.tertiary });

    // Separator
    const sep = "─".repeat(Math.min(maxW, 60));
    const sepCol = Math.max(0, Math.floor((maxW - stringWidth(sep)) / 2));
    frame.writeText(1, sepCol, sep, { fg: t.tertiary, dim: true });

    if (this.entries.length === 0) {
      const empty = "No readings yet";
      const emptyCol = Math.max(0, Math.floor((maxW - stringWidth(empty)) / 2));
      frame.writeText(Math.floor(ctx.rows / 2), emptyCol, empty, { fg: t.secondary });
      return;
    }

    // Scrollable list
    const viewportTop = 2;
    const viewportH = ctx.rows - 4;
    const visibleStart = this.scroll.scrollOffset;
    const visibleEnd = Math.min(this.entries.length, visibleStart + viewportH);

    for (let i = visibleStart; i < visibleEnd; i++) {
      const entry = this.entries[i];
      const row = viewportTop + (i - visibleStart);
      if (row >= ctx.rows - 2) break;

      const gua = GUA[entry.cast.primary - 1];
      const isSelected = i === this.cursor;

      // Date
      const date = entry.date;

      // Hexagram info
      let line = `${date}   ${gua.u} ${gua.n} (${gua.p})`;

      // Becoming
      if (entry.cast.becoming !== null) {
        const bg = GUA[entry.cast.becoming - 1];
        line += ` → ${bg.u} ${bg.n}`;
        if (entry.cast.changingPositions?.length) {
          line += ` [${entry.cast.changingPositions.join(",")}]`;
        }
      } else {
        // No suffix for unchanging — silence is the message
      }

      // Truncate to width
      if (stringWidth(line) > maxW - 4) {
        line = line.slice(0, maxW - 5) + "…";
      }

      const col = 3;
      const cursor = isSelected ? " > " : "   ";
      const fg = isSelected ? t.primary : t.secondary;
      const cursorFg = isSelected ? t.accent : t.tertiary;

      frame.writeText(row, 0, cursor, { fg: cursorFg });
      frame.writeText(row, col, line, { fg, bold: isSelected });
    }

    // Scroll indicator
    if (this.entries.length > viewportH) {
      const pct = Math.round((this.cursor / (this.entries.length - 1)) * 100);
      const indicator = `${this.cursor + 1}/${this.entries.length} (${pct}%)`;
      frame.writeText(ctx.rows - 2, maxW - stringWidth(indicator) - 1, indicator, { fg: t.tertiary });
    }

    // Footer
    const footer = "↑↓ navigate   enter view   d dictionary   esc/q back";
    const footerCol = Math.max(0, Math.floor((maxW - stringWidth(footer)) / 2));
    frame.writeText(ctx.rows - 1, footerCol, footer, { fg: t.tertiary });

    // Detail preview of selected entry
    if (this.entries[this.cursor]) {
      const selected = this.entries[this.cursor];
      const gua = GUA[selected.cast.primary - 1];
      const structure = buildStructure(selected.cast);

      // Show English image below the list separator
      const detailRow = ctx.rows - 2;
      const detail = gua.en;
      if (stringWidth(detail) <= maxW - 4) {
        frame.writeText(detailRow, 2, detail, { fg: t.tertiary, dim: true });
      }
    }
  }

  handleKey(key: KeyEvent, _ctx: SceneContext): SceneSignal | void {
    if (this.entries.length === 0) {
      if (key.type === "char" && (key.char === "q" || key.char === "d")) return "exit";
      if (key.type === "escape") return "exit";
      if (key.type === "ctrl" && key.char === "c") return "exit";
      return;
    }

    if (key.type === "arrow") {
      if (key.direction === "up") {
        this.cursor = Math.max(0, this.cursor - 1);
        this.ensureCursorVisible();
      } else if (key.direction === "down") {
        this.cursor = Math.min(this.entries.length - 1, this.cursor + 1);
        this.ensureCursorVisible();
      }
    }

    if (key.type === "page") {
      if (key.direction === "up") {
        this.cursor = Math.max(0, this.cursor - this.scroll.viewportHeight);
        this.scroll.pageUp();
      } else {
        this.cursor = Math.min(this.entries.length - 1, this.cursor + this.scroll.viewportHeight);
        this.scroll.pageDown();
      }
    }

    if (key.type === "enter") {
      // Open reading view for selected entry
      const entry = this.entries[this.cursor];
      if (entry) {
        return { goto: `reading:${this.cursor}` };
      }
    }

    if (key.type === "char" && key.char === "d") {
      return { goto: "dictionary" };
    }

    if (key.type === "char" && key.char === "q") return "exit";
    if (key.type === "escape") return "exit";
    if (key.type === "ctrl" && key.char === "c") return "exit";
  }

  private ensureCursorVisible(): void {
    const viewportH = this.scroll.viewportHeight;
    if (this.cursor < this.scroll.scrollOffset) {
      this.scroll.scrollOffset = this.cursor;
    } else if (this.cursor >= this.scroll.scrollOffset + viewportH) {
      this.scroll.scrollOffset = this.cursor - viewportH + 1;
    }
  }
}
