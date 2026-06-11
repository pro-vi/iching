// JournalScene — scrollable timeline of past readings, and an instrument of
// reflection: incremental search over intentions and hexagram names ([/]),
// reflection notes attached to past readings ([n]), a door into the
// dictionary for the selected entry ([g]), and a quiet patterns pane over
// everything cast so far ([p]).

import type { Scene, SceneContext, SceneSignal } from "../../scene/types.ts";
import type { CellBuffer } from "../../render/buffer.ts";
import type { KeyEvent } from "../../input/key-parser.ts";
import type { DisplayLanguage, HistoryEntry } from "@iching/core";
import { GUA, toSimplified } from "@iching/core";
import { getTheme } from "../../color/theme.ts";
import { stringWidth } from "../../layout/measure.ts";
import { ScrollableRegion } from "../../widgets/scrollable.ts";
import { TextInput } from "../../widgets/text-input.ts";
import { tr } from "../../i18n/messages.ts";
import { computeJournalPatterns } from "./journal-patterns.ts";

/** A reflection note as the journal renders it (storage records carry more). */
export interface JournalNoteView {
  text: string;
  date: string;
}

/** Journal entry plus its attached reflection notes. */
export interface JournalEntryView extends HistoryEntry {
  notes?: JournalNoteView[];
}

export interface JournalSceneOptions {
  /**
   * Persist a committed reflection note. The scene updates its own view
   * (marker + preview) immediately; persistence rides this callback so the
   * scene stays storage-free.
   */
  onNote?: (entry: JournalEntryView, text: string) => void;
  /** Local YYYY-MM-DD — injected for tests; defaults to the system clock. */
  today?: () => string;
}

/** Strip diacritics for accent-insensitive pinyin matching. */
function normalize(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Does this hexagram match the query (name / simplified / pinyin / ename / number)? */
function hexagramMatches(kw: number, q: string): boolean {
  const gua = GUA[kw - 1];
  if (!gua) return false;
  return (
    gua.n.includes(q) ||
    toSimplified(gua.n).includes(q) ||
    normalize(gua.p).includes(q) ||
    normalize(gua.ename).includes(q) ||
    String(kw).startsWith(q)
  );
}

/** Live search predicate: intention text + primary/becoming hexagram. */
export function entryMatchesQuery(entry: HistoryEntry, query: string): boolean {
  const q = normalize(query.trim());
  if (q.length === 0) return true;
  if (entry.intention && normalize(entry.intention).includes(q)) return true;
  if (hexagramMatches(entry.cast.primary, q)) return true;
  if (entry.cast.becoming !== null && hexagramMatches(entry.cast.becoming, q)) return true;
  return false;
}

export class JournalScene implements Scene {
  private entries: JournalEntryView[];
  private filtered: JournalEntryView[];
  private cursor: number;
  private scroll: ScrollableRegion;
  private opts: JournalSceneOptions;

  // [/] incremental search
  private searchActive = false;
  private searchInput: TextInput;

  // [n] one-line reflection-note input (rendered in-scene, not a new Scene)
  private noteActive = false;
  private noteInput: TextInput;

  // [p] patterns pane
  private patternsOpen = false;

  constructor(entries: JournalEntryView[], opts: JournalSceneOptions = {}) {
    // Most recent first
    this.entries = [...entries].reverse();
    this.filtered = this.entries;
    this.cursor = 0;
    this.scroll = new ScrollableRegion(20, []);
    this.opts = opts;
    this.searchInput = new TextInput();
    this.noteInput = new TextInput();
  }

  enter(ctx: SceneContext): void {
    this.scroll.viewportHeight = ctx.rows - 4; // header(2) + preview + footer
  }

  update(_elapsed: number, _dt: number, _ctx: SceneContext): void {}

  resize(cols: number, rows: number): void {
    this.scroll.viewportHeight = rows - 4;
  }

  render(frame: CellBuffer, ctx: SceneContext): void {
    const t = getTheme();
    const lang = ctx.language ?? "en";
    const maxW = ctx.cols;

    // Header
    const title = tr(lang, "journal.title");
    const titleCol = Math.max(0, Math.floor((maxW - stringWidth(title)) / 2));
    frame.writeText(0, titleCol, title, { fg: t.primary, bold: true });

    const countText = `${this.filtered.length} ${tr(lang, "journal.countSuffix")}`;
    frame.writeText(0, maxW - stringWidth(countText) - 1, countText, { fg: t.tertiary });

    // Separator row doubles as the search input when search is live.
    if (this.searchActive) {
      const label = tr(lang, "dict.searchPrompt");
      const labelW = stringWidth(label);
      frame.writeText(1, 1, label, { fg: t.accent });
      this.searchInput.render(frame, 1, 1 + labelW, maxW - 2 - labelW, { fg: t.primary });
    } else {
      const sep = "─".repeat(Math.min(maxW, 60));
      const sepCol = Math.max(0, Math.floor((maxW - stringWidth(sep)) / 2));
      frame.writeText(1, sepCol, sep, { fg: t.tertiary, dim: true });
    }

    if (this.entries.length === 0) {
      const empty = tr(lang, "journal.empty");
      const emptyCol = Math.max(0, Math.floor((maxW - stringWidth(empty)) / 2));
      frame.writeText(Math.floor(ctx.rows / 2), emptyCol, empty, { fg: t.secondary });
      return;
    }

    if (this.patternsOpen) {
      this.renderPatterns(frame, ctx, lang);
      this.renderFooter(frame, ctx, lang);
      return;
    }

    this.renderList(frame, ctx, lang);
    this.renderPreviewRow(frame, ctx, lang);
    this.renderFooter(frame, ctx, lang);
  }

  private renderList(frame: CellBuffer, ctx: SceneContext, lang: DisplayLanguage): void {
    const t = getTheme();
    const maxW = ctx.cols;
    const viewportTop = 2;
    const viewportH = ctx.rows - 4;
    const visibleStart = this.scroll.scrollOffset;
    const visibleEnd = Math.min(this.filtered.length, visibleStart + viewportH);

    for (let i = visibleStart; i < visibleEnd; i++) {
      const entry = this.filtered[i];
      const row = viewportTop + (i - visibleStart);
      if (row >= ctx.rows - 2) break;

      const gua = GUA[entry.cast.primary - 1];
      const isSelected = i === this.cursor;

      // Date + optional time
      const date = entry.date;
      const time = entry.timestamp ? formatTime(entry.timestamp) : "";
      const dateCol = time ? `${date}  ${time}` : date;

      // Hexagram info — convert names for zh-Hans (no English in Chinese modes).
      const cn = (s: string): string => (lang === "zh-Hans" ? toSimplified(s) : s);
      let line = `${dateCol}   ${gua.u} ${cn(gua.n)} (${gua.p})`;

      // Becoming
      if (entry.cast.becoming !== null) {
        const bg = GUA[entry.cast.becoming - 1];
        line += ` → ${bg.u} ${cn(bg.n)}`;
        if (entry.cast.changingPositions?.length) {
          line += ` [${entry.cast.changingPositions.join(",")}]`;
        }
      }

      // Intention
      if (entry.intention) {
        const maxLen = 30;
        const truncated = entry.intention.length > maxLen
          ? entry.intention.slice(0, maxLen - 1) + "…"
          : entry.intention;
        line += `  “${truncated}”`;
      }

      // Quiet marker for annotated entries (·註 / ·note)
      if (entry.notes?.length) {
        line += `  ·${tr(lang, "journal.noteMarker")}`;
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
    if (this.filtered.length > viewportH) {
      const pct = Math.round((this.cursor / (this.filtered.length - 1)) * 100);
      const indicator = `${this.cursor + 1}/${this.filtered.length} (${pct}%)`;
      frame.writeText(ctx.rows - 2, maxW - stringWidth(indicator) - 1, indicator, { fg: t.tertiary });
    }
  }

  /** Preview row (rows-2): note input > latest note > the entry's image text. */
  private renderPreviewRow(frame: CellBuffer, ctx: SceneContext, lang: DisplayLanguage): void {
    const t = getTheme();
    const maxW = ctx.cols;
    const detailRow = ctx.rows - 2;
    const selected = this.filtered[this.cursor];

    if (this.noteActive) {
      const label = tr(lang, "journal.notePrompt");
      const labelW = stringWidth(label);
      frame.writeText(detailRow, 2, label, { fg: t.accent });
      this.noteInput.render(frame, detailRow, 2 + labelW, maxW - 4 - labelW, { fg: t.primary });
      return;
    }

    if (!selected) return;

    const latestNote = selected.notes?.[selected.notes.length - 1];
    if (latestNote) {
      let text = `·${tr(lang, "journal.noteMarker")} ${latestNote.date}  ${latestNote.text}`;
      if (stringWidth(text) > maxW - 4) {
        text = text.slice(0, maxW - 5) + "…";
      }
      frame.writeText(detailRow, 2, text, { fg: t.tertiary, dim: true });
      return;
    }

    // Image preview: English image in en mode; the 大象傳 (converted for 简) in zh modes
    const gua = GUA[selected.cast.primary - 1];
    const detail = lang === "en" ? gua.en : lang === "zh-Hans" ? toSimplified(gua.dx) : gua.dx;
    if (stringWidth(detail) <= maxW - 4) {
      frame.writeText(detailRow, 2, detail, { fg: t.tertiary, dim: true });
    }
  }

  /** The quiet observatory: counts and dates over the loaded entries. */
  private renderPatterns(frame: CellBuffer, ctx: SceneContext, lang: DisplayLanguage): void {
    const t = getTheme();
    const today = this.opts.today ? this.opts.today() : localToday();
    const patterns = computeJournalPatterns(this.entries, today);
    const cn = (s: string): string => (lang === "zh-Hans" ? toSimplified(s) : s);

    const top = 3;
    const col = 4;
    let row = top;
    const put = (text: string, style: Parameters<CellBuffer["writeText"]>[3]): void => {
      if (row < ctx.rows - 2) frame.writeText(row, col, text, style);
      row++;
    };

    put(tr(lang, "journal.patterns.title"), { fg: t.primary, bold: true });
    row++;

    put(
      `${patterns.total} ${tr(lang, "journal.countSuffix")}  ·  ${tr(lang, "journal.patterns.thisMonth")} ${patterns.thisMonth}`,
      { fg: t.secondary },
    );
    row++;

    if (patterns.topHexagrams.length > 0) {
      put(tr(lang, "journal.patterns.mostSeen"), { fg: t.tertiary, dim: true });
      for (const hex of patterns.topHexagrams) {
        const gua = GUA[hex.kw - 1];
        put(`${gua.u} ${cn(gua.n)} (${gua.p})   ×${hex.count} · ${hex.lastDate}`, { fg: t.secondary });
      }
      row++;
    }

    if (patterns.movingLine) {
      put(
        `${tr(lang, "journal.patterns.movingLine")} · ${patterns.movingLine.position} (×${patterns.movingLine.count})`,
        { fg: t.tertiary, dim: true },
      );
    }
  }

  private renderFooter(frame: CellBuffer, ctx: SceneContext, lang: DisplayLanguage): void {
    const t = getTheme();
    const maxW = ctx.cols;
    // Single-space separators: the full key list must fit 80 columns.
    let footer: string;
    if (this.noteActive) {
      footer = `[enter] ${tr(lang, "verb.confirm")} · [esc] ${tr(lang, "verb.back")}`;
    } else if (this.patternsOpen) {
      // p also closes (a quiet toggle); only the universal key is advertised.
      footer = `[esc] ${tr(lang, "verb.back")}`;
    } else if (this.searchActive) {
      footer = `[↑↓] ${tr(lang, "verb.navigate")} · [enter] ${tr(lang, "verb.view")} · [esc] ${tr(lang, "verb.clearSearch")}`;
    } else {
      footer =
        `[enter] ${tr(lang, "verb.view")} · [n] ${tr(lang, "verb.note")} · [g] ${tr(lang, "verb.detail")}` +
        ` · [/] ${tr(lang, "verb.search")} · [p] ${tr(lang, "verb.patterns")} · [esc] ${tr(lang, "verb.back")}`;
    }
    const footerCol = Math.max(0, Math.floor((maxW - stringWidth(footer)) / 2));
    frame.writeText(ctx.rows - 1, footerCol, footer, { fg: t.tertiary });
  }

  handleKey(key: KeyEvent, _ctx: SceneContext): SceneSignal | void {
    if (key.type === "ctrl" && key.char === "c") return { type: "exit" };

    if (this.entries.length === 0) {
      if (key.type === "char" && (key.char === "q" || key.char === "d")) return { type: "back" };
      if (key.type === "escape") return { type: "back" };
      return;
    }

    if (this.noteActive) return this.handleNoteKey(key);
    if (this.patternsOpen) return this.handlePatternsKey(key);
    if (this.searchActive) return this.handleSearchKey(key);

    if (key.type === "arrow") {
      if (key.direction === "up") this.moveCursor(-1);
      else if (key.direction === "down") this.moveCursor(1);
      return;
    }

    if (key.type === "page") {
      if (key.direction === "up") {
        this.cursor = Math.max(0, this.cursor - this.scroll.viewportHeight);
        this.scroll.pageUp();
      } else {
        this.cursor = Math.min(this.filtered.length - 1, this.cursor + this.scroll.viewportHeight);
        this.scroll.pageDown();
      }
      return;
    }

    if (key.type === "home") {
      this.cursor = 0;
      this.scroll.scrollOffset = 0;
      return;
    }

    if (key.type === "end") {
      this.cursor = Math.max(0, this.filtered.length - 1);
      this.ensureCursorVisible();
      return;
    }

    if (key.type === "enter") {
      const entry = this.filtered[this.cursor];
      if (entry) {
        const entryKey = entry.timestamp || entry.date;
        return { type: "openJournalReading", key: entryKey };
      }
      return;
    }

    if (key.type === "char") {
      switch (key.char) {
        // Nav parity with the dict browser: j/k when search is not active.
        case "j":
          this.moveCursor(1);
          return;
        case "k":
          this.moveCursor(-1);
          return;
        case "/":
          this.searchActive = true;
          return;
        case "n":
          if (this.filtered[this.cursor]) {
            this.noteActive = true;
            this.noteInput.clear();
          }
          return;
        case "g": {
          // Door into the dictionary: the entry's primary hexagram, with its
          // cast's moving lines marked.
          const entry = this.filtered[this.cursor];
          if (entry) {
            const changed = entry.cast.changingPositions;
            return changed?.length
              ? { type: "openDetail", kw: entry.cast.primary, changedPositions: [...changed] }
              : { type: "openDetail", kw: entry.cast.primary };
          }
          return;
        }
        case "p":
          this.patternsOpen = true;
          return;
        case "d":
          return { type: "openDictionary" };
        case "q":
          return { type: "back" };
      }
      return;
    }

    if (key.type === "escape") return { type: "back" };
  }

  private handleNoteKey(key: KeyEvent): SceneSignal | void {
    if (key.type === "enter") {
      const text = this.noteInput.value.trim();
      this.noteActive = false;
      this.noteInput.clear();
      if (!text) return; // empty note is a cancel, not an entry
      const entry = this.filtered[this.cursor];
      if (!entry) return;
      const date = this.opts.today ? this.opts.today() : localToday();
      entry.notes = [...(entry.notes ?? []), { text, date }];
      this.opts.onNote?.(entry, text);
      return;
    }
    if (key.type === "escape") {
      this.noteActive = false;
      this.noteInput.clear();
      return;
    }
    if (key.type === "arrow") {
      if (key.direction === "left") this.noteInput.moveCursorLeft();
      if (key.direction === "right") this.noteInput.moveCursorRight();
      return;
    }
    if (key.type === "backspace") {
      this.noteInput.backspace();
      return;
    }
    if (key.type === "delete") {
      this.noteInput.delete();
      return;
    }
    if (key.type === "home") {
      this.noteInput.moveToStart();
      return;
    }
    if (key.type === "end") {
      this.noteInput.moveToEnd();
      return;
    }
    if (key.type === "paste") {
      // A pasted reflection arrives as one block: fold newlines/tabs to
      // spaces (enter must not submit mid-paste) and drop control chars.
      const text = key.text.replace(/[\n\t]+/g, " ").replace(/[\x00-\x1f\x7f]/g, "");
      if (text.length > 0) this.noteInput.insert(text);
      return;
    }
    if (key.type === "char") {
      this.noteInput.insert(key.char);
      return;
    }
  }

  private handlePatternsKey(key: KeyEvent): SceneSignal | void {
    if (key.type === "escape" || (key.type === "char" && (key.char === "p" || key.char === "q"))) {
      this.patternsOpen = false;
      return;
    }
  }

  private handleSearchKey(key: KeyEvent): SceneSignal | void {
    if (key.type === "escape") {
      this.searchActive = false;
      this.searchInput.clear();
      this.setQuery("");
      return;
    }
    if (key.type === "enter") {
      const entry = this.filtered[this.cursor];
      if (entry) {
        const entryKey = entry.timestamp || entry.date;
        return { type: "openJournalReading", key: entryKey };
      }
      return;
    }
    if (key.type === "arrow") {
      if (key.direction === "up") this.moveCursor(-1);
      else if (key.direction === "down") this.moveCursor(1);
      return;
    }
    if (key.type === "backspace") {
      this.searchInput.backspace();
      this.setQuery(this.searchInput.value);
      return;
    }
    if (key.type === "paste") {
      const text = key.text.replace(/[\n\t]+/g, " ").replace(/[\x00-\x1f\x7f]/g, "");
      if (text.length > 0) {
        this.searchInput.insert(text);
        this.setQuery(this.searchInput.value);
      }
      return;
    }
    if (key.type === "char") {
      this.searchInput.insert(key.char);
      this.setQuery(this.searchInput.value);
      return;
    }
  }

  private setQuery(query: string): void {
    this.filtered =
      query.trim().length > 0
        ? this.entries.filter((e) => entryMatchesQuery(e, query))
        : this.entries;
    if (this.cursor >= this.filtered.length) {
      this.cursor = Math.max(0, this.filtered.length - 1);
    }
    this.scroll.scrollOffset = 0;
    this.ensureCursorVisible();
  }

  private moveCursor(delta: number): void {
    this.cursor = Math.min(Math.max(0, this.cursor + delta), Math.max(0, this.filtered.length - 1));
    this.ensureCursorVisible();
  }

  private ensureCursorVisible(): void {
    // Same cursor-into-view math the dict browse list uses; the ScrollableRegion
    // this scene already owns exposes it (offsetToShow), so don't re-derive it.
    this.scroll.ensureVisible(this.cursor);
  }
}

/** Extract HH:MM from an ISO timestamp */
function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** Local YYYY-MM-DD (default for the injected `today`). */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
