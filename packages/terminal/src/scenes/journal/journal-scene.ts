// JournalScene — scrollable timeline of past readings, and an instrument of
// reflection: incremental search over intentions and hexagram names ([/]),
// reflection notes attached to past readings ([n]), a door into the
// dictionary for the selected entry ([g]), and a quiet patterns pane over
// everything cast so far ([p]).

import type { Scene, SceneContext, SceneSignal } from "../../scene/types.ts";
import type { CellBuffer } from "../../render/buffer.ts";
import type { KeyEvent } from "../../input/key-parser.ts";
import type { DisplayLanguage, HistoryEntry } from "@iching/core";
import { GUA, TRIGRAMS, stripTerminalControls, toSimplified } from "@iching/core";
import { getTheme } from "../../color/theme.ts";
import { stringWidth } from "../../layout/measure.ts";
import { ScrollableRegion } from "../../widgets/scrollable.ts";
import { TextInput } from "../../widgets/text-input.ts";
import { tr } from "../../i18n/messages.ts";
import { computeJournalPatterns, type JournalPatterns, type StructuralEcho } from "@iching/core";

type TextStyle = Parameters<CellBuffer["writeText"]>[3];

/** One styled span of a patterns-pane row. */
interface PatternSegment {
  text: string;
  style: TextStyle;
}

/** A patterns-pane row: styled spans written left-to-right from the margin. */
interface PatternRow {
  segments: PatternSegment[];
}

// Patterns pane geometry/policy (see the 觀象 sections in patternRows):
// chance/expected figures render only once this many method-marked readings
// exist — below that, observed-vs-expected is statistical theatre.
const CHANCE_MIN_KNOWN = 8;
// The single label column every section aligns to (display columns). 17 is the
// widest en faces label across all 64 hexagrams — 「䷡ 大壯 Dà Zhuàng」.
const LABEL_W = 17;
// Eighth-block ramp for the cast-to-cast drift sparkline.
const SPARK_BLOCKS = "▁▂▃▄▅▆▇█";
const LINE_KEYS = [
  "journal.patterns.line1",
  "journal.patterns.line2",
  "journal.patterns.line3",
  "journal.patterns.line4",
  "journal.patterns.line5",
  "journal.patterns.line6",
] as const;

/** A reflection note as the journal renders it (storage records carry more). */
export interface JournalNoteView {
  text: string;
  date: string;
  /**
   * Persistence state for notes committed this session: "pending" while the
   * append is in flight (rendered dim), "saved" once it lands. A failed
   * append removes the note from its entry instead. Notes loaded from disk
   * carry no state — they are already durable.
   */
  state?: "pending" | "saved";
}

/** Journal entry plus its attached reflection notes. */
export interface JournalEntryView extends HistoryEntry {
  notes?: JournalNoteView[];
}

export interface JournalSceneOptions {
  /**
   * Persist a committed reflection note. The scene updates its own view
   * (marker + preview) immediately; persistence rides this callback so the
   * scene stays storage-free. Returning the append promise lets the scene
   * track the note honestly — pending until it settles, withdrawn (with one
   * calm line) when the write fails — and await in-flight writes on exit.
   */
  onNote?: (entry: JournalEntryView, text: string) => void | Promise<void>;
  /** Local YYYY-MM-DD — injected for tests; defaults to the system clock. */
  today?: () => string;
}

/**
 * Sanitize typed/pasted text for the scene's one-line inputs: fold
 * newlines/tabs to spaces (enter must not submit mid-paste) and strip the
 * remaining C0/C1 control characters — including ESC (0x1B), so a pasted
 * ANSI sequence cannot leak raw control bytes into a stored note.
 */
export function sanitizeFieldText(text: string): string {
  return stripTerminalControls(text);
}

/** Strip diacritics for accent-insensitive pinyin matching. */
function normalize(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Truncate to a display-width budget with a trailing one-column ellipsis.
 * List rows and previews must clip by terminal columns, not UTF-16 code
 * units — a CJK string sliced by code units keeps up to twice its budget
 * and runs off the right edge (taking the ellipsis with it).
 */
export function truncateToWidth(text: string, maxWidth: number): string {
  if (maxWidth <= 0) return "";
  if (stringWidth(text) <= maxWidth) return text;
  const budget = maxWidth - 1; // reserve one column for the ellipsis
  let out = "";
  let used = 0;
  for (const ch of text) {
    const w = stringWidth(ch);
    if (used + w > budget) break;
    out += ch;
    used += w;
  }
  return out + "…";
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
  private patternsScroll: ScrollableRegion;
  private opts: JournalSceneOptions;

  // [/] incremental search
  private searchActive = false;
  private searchInput: TextInput;

  // [n] one-line reflection-note input (rendered in-scene, not a new Scene)
  private noteActive = false;
  private noteInput: TextInput;

  // [p] patterns pane. The derivation is pure over (entries, today) and the
  // entries never change while the pane is open (notes don't touch cast data),
  // so it is memoized — the 30 FPS loop must not recompute it every frame
  // (≈3ms/frame over a 2000-reading journal). Keyed on today for the midnight
  // rollover; the stable entries reference needs no key.
  private patternsOpen = false;
  private cachedPatterns: JournalPatterns | null = null;
  private cachedPatternsToday = "";

  // Reflection-note persistence honesty: appends still in flight (awaited by
  // exit() so scene teardown can't lose a pending write) and entries whose
  // last append failed (one calm line in the preview row).
  private inFlightNotes = new Set<Promise<void>>();
  private failedNoteEntries = new Set<JournalEntryView>();

  constructor(entries: JournalEntryView[], opts: JournalSceneOptions = {}) {
    // Most recent first. Drop any entry without a usable cast at the boundary
    // (storage validates, so this is defense-in-depth): every downstream site —
    // the list row, the field, the patterns derivation — indexes cast.primary,
    // and one cast-less record must not take the whole scene down.
    this.entries = entries
      .filter((e) => e?.cast != null && typeof e.cast.primary === "number")
      .reverse();
    this.filtered = this.entries;
    this.cursor = 0;
    this.scroll = new ScrollableRegion(20, []);
    this.patternsScroll = new ScrollableRegion(20, []);
    this.opts = opts;
    this.searchInput = new TextInput();
    this.noteInput = new TextInput();
  }

  enter(ctx: SceneContext): void {
    this.scroll.viewportHeight = ctx.rows - 4; // header(2) + preview + footer
    this.patternsScroll.viewportHeight = Math.max(1, ctx.rows - 3); // top margin + indicator + footer
  }

  exit(): Promise<void> {
    // Scene teardown (pop, push, or leaving the program) waits for pending
    // note appends — esc or quit right after committing a note must not
    // lose the write. runScene awaits this before the router proceeds.
    return this.notesSettled();
  }

  /** Resolves when every in-flight note append has settled. */
  async notesSettled(): Promise<void> {
    while (this.inFlightNotes.size > 0) {
      await Promise.allSettled([...this.inFlightNotes]);
    }
  }

  update(_elapsed: number, _dt: number, _ctx: SceneContext): void {}

  resize(cols: number, rows: number): void {
    this.scroll.viewportHeight = rows - 4;
    this.patternsScroll.viewportHeight = Math.max(1, rows - 3);
    this.patternsScroll.scrollDown(0);
  }

  render(frame: CellBuffer, ctx: SceneContext): void {
    const t = getTheme();
    const lang = ctx.language ?? "en";
    const maxW = ctx.cols;

    // The patterns observatory owns the whole screen: its own 觀象 rule is the
    // header and it restates the reading count itself, so the journal-list
    // chrome (title · count · separator) would only compete. Render it alone.
    if (this.patternsOpen && this.entries.length > 0) {
      this.renderPatterns(frame, ctx, lang);
      this.renderFooter(frame, ctx, lang);
      return;
    }

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

      // Intention — a 30-column budget (CJK counts double)
      if (entry.intention) {
        line += `  “${truncateToWidth(entry.intention, 30)}”`;
      }

      // Quiet marker for annotated entries (·註 / ·note)
      if (entry.notes?.length) {
        line += `  ·${tr(lang, "journal.noteMarker")}`;
      }

      // Truncate to the viewport's column budget
      line = truncateToWidth(line, maxW - 4);

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

    // A failed append withdrew its note (marker gone) — one calm line says so.
    if (this.failedNoteEntries.has(selected)) {
      const failed = truncateToWidth(tr(lang, "journal.noteSaveFailed"), maxW - 4);
      frame.writeText(detailRow, 2, failed, { fg: t.tertiary, dim: true });
      return;
    }

    const latestNote = selected.notes?.[selected.notes.length - 1];
    if (latestNote) {
      const text = truncateToWidth(
        `·${tr(lang, "journal.noteMarker")} ${latestNote.date}  ${latestNote.text}`,
        maxW - 4,
      );
      // Dim only while the append is in flight — a settled note holds the
      // regular tertiary weight.
      frame.writeText(detailRow, 2, text, {
        fg: t.tertiary,
        dim: latestNote.state === "pending",
      });
      return;
    }

    // Image preview: English image in en mode; the 大象傳 (converted for 简) in zh modes
    const gua = GUA[selected.cast.primary - 1];
    const detail = lang === "en" ? gua.en : lang === "zh-Hans" ? toSimplified(gua.dx) : gua.dx;
    if (stringWidth(detail) <= maxW - 4) {
      frame.writeText(detailRow, 2, detail, { fg: t.tertiary, dim: true });
    }
  }

  /** The quiet observatory: the field of 64, then ruled sections of observation. */
  private renderPatterns(frame: CellBuffer, ctx: SceneContext, lang: DisplayLanguage): void {
    const t = getTheme();
    const rows = this.patternRows(ctx, lang);
    // No journal-list header above the pane any more, so it opens near the top
    // (row 0 is a calm margin); the 觀象 rule is its own title. viewport = total
    // rows − margin − indicator − footer.
    this.patternsScroll.viewportHeight = Math.max(1, ctx.rows - 3);
    // ScrollableRegion only needs row count for its math; joined text suffices.
    this.patternsScroll.contentLines = rows.map((row) =>
      row.segments.map((seg) => seg.text).join(""),
    );
    this.patternsScroll.scrollDown(0);

    const top = 1;
    const budget = Math.max(0, ctx.cols - 3);
    const visibleEnd = Math.min(
      rows.length,
      this.patternsScroll.scrollOffset + this.patternsScroll.viewportHeight,
    );

    for (let i = this.patternsScroll.scrollOffset; i < visibleEnd; i++) {
      const screenRow = top + (i - this.patternsScroll.scrollOffset);
      if (screenRow >= ctx.rows - 2) break;
      // Write segments left-to-right tracking display width; the segment that
      // crosses the budget is ellipsis-truncated, anything after it drops.
      // Rows keep their most expendable spans rightmost so clipping degrades
      // gracefully (last-date first, then chance clauses).
      let used = 0;
      for (const seg of rows[i].segments) {
        if (used >= budget) break;
        const w = stringWidth(seg.text);
        if (used + w > budget) {
          frame.writeText(screenRow, 2 + used, truncateToWidth(seg.text, budget - used), seg.style);
          break;
        }
        frame.writeText(screenRow, 2 + used, seg.text, seg.style);
        used += w;
      }
    }

    if (rows.length > this.patternsScroll.viewportHeight) {
      const indicator = this.patternsScroll.scrollIndicator();
      frame.writeText(ctx.rows - 2, ctx.cols - stringWidth(indicator) - 1, indicator, {
        fg: t.tertiary,
        dim: true,
      });
    }
  }

  private patternRows(ctx: SceneContext, lang: DisplayLanguage): PatternRow[] {
    const t = getTheme();
    const today = this.opts.today ? this.opts.today() : localToday();
    if (!this.cachedPatterns || this.cachedPatternsToday !== today) {
      this.cachedPatterns = computeJournalPatterns(this.entries, today);
      this.cachedPatternsToday = today;
    }
    const patterns = this.cachedPatterns;
    const cn = (s: string): string => (lang === "zh-Hans" ? toSimplified(s) : s);
    const rows: PatternRow[] = [];

    // ── span vocabulary ──
    const stLabel: TextStyle = { fg: t.tertiary };
    const stNum: TextStyle = { fg: t.primary };
    const stName: TextStyle = { fg: t.primary };
    const stSep: TextStyle = { fg: t.tertiary, dim: true };
    const stQuiet: TextStyle = { fg: t.tertiary, dim: true };
    const stBar: TextStyle = { fg: t.secondary };
    const stRest: TextStyle = { fg: t.dimmed };

    const lab = (text: string): PatternSegment => ({ text, style: stLabel });
    const num = (text: string): PatternSegment => ({ text, style: stNum });
    const quiet = (text: string): PatternSegment => ({ text, style: stQuiet });
    const sep = (): PatternSegment => ({ text: " · ", style: stSep });

    const row = (...segments: PatternSegment[]): void => {
      rows.push({ segments: segments.filter((seg) => seg.text.length > 0) });
    };
    const blank = (): void => {
      rows.push({ segments: [] });
    };

    // ── geometry & policy ──
    const inner = Math.max(8, ctx.cols - 4);
    const narrow = ctx.cols < 64;
    const barW = Math.max(4, Math.min(12, ctx.cols - 56));
    const gate = patterns.baseline.methods.known >= CHANCE_MIN_KNOWN;
    // No-color terminals strip fg tones but keep the bold/dim attributes, so
    // the field's brightness tiers would collapse. Carry the unlit tier on dim
    // there so the dark field still reads (color mode is untouched: dim false).
    const mono = ctx.colorSupport === "none";

    /**
     * Section rule: '── title ┄────…' with a note set flush right as a margin
     * whisper. The ┄ is a quiet hinge where the title hands off to the faint
     * rule; the note ends the line unboxed (no closing ──), reading as an
     * annotation rather than a label. Total width stays `inner` so rules align.
     */
    const rule = (title: string, titleStyle: TextStyle, note?: string): void => {
      const titleW = stringWidth(title);
      let noteText = note;
      // consumed = '── ' + title + ' ┄' + fill + (note ? ' ' + note : '')
      let fill = inner - 3 - titleW - 2 - (noteText !== undefined ? 1 + stringWidth(noteText) : 0);
      if (noteText !== undefined && fill < 2) {
        noteText = undefined;
        fill = inner - 3 - titleW - 2;
      }
      fill = Math.max(0, fill);
      const segs: PatternSegment[] = [
        { text: "── ", style: stSep },
        { text: title, style: titleStyle },
        { text: " ┄", style: stSep },
        { text: "─".repeat(fill), style: stSep },
      ];
      if (noteText !== undefined) segs.push({ text: ` ${noteText}`, style: stLabel });
      row(...segs);
    };

    /** Pad a label group to the shared column so values align pane-wide. */
    const label = (segs: PatternSegment[]): PatternSegment[] => {
      const w = segs.reduce((sum, seg) => sum + stringWidth(seg.text), 0);
      return [...segs, { text: " ".repeat(Math.max(1, LABEL_W - w + 1)), style: stLabel }];
    };

    // Bars in the lower-block family — ▅ ink fading to a faint ▁ groove, both
    // resting on the cell baseline. This is the same family as the 次第 drift
    // sparkline (▁▂▃▄▅▆▇█), so the pane speaks one glyph language; ▅ is softer
    // ink than a full █ block, and ▁ a quieter track than ░ shade. Rounded to
    // whole cells: these are glanceable proportions, not a precision meter.
    const bar = (count: number, max: number): PatternSegment[] => {
      const filled = count <= 0 || max <= 0 ? 0 : Math.max(1, Math.round((count / max) * barW));
      return [
        { text: "▅".repeat(Math.min(barW, filled)), style: stBar },
        { text: "▁".repeat(Math.max(0, barW - filled)), style: stRest },
      ];
    };

    const chanceNum = (v: number): string => formatNumber(v, v < 10 ? 1 : 0);
    /** ' · by chance ~N' — only once enough method-marked casts exist. */
    const chance = (v: number | null): PatternSegment[] =>
      gate && v !== null
        ? [sep(), lab(`${tr(lang, "journal.patterns.chanceSays")}${chanceNum(v)}`)]
        : [];
    const segW = (segs: PatternSegment[]): number =>
      segs.reduce((sum, seg) => sum + stringWidth(seg.text), 0);
    const budget = Math.max(0, ctx.cols - 3);
    /**
     * ' · last MM-DD' — the most expendable span. It rides a row only when it
     * fits whole; below that it drops outright rather than truncating to a
     * half-date. (`narrow` already drops it on very small terminals.)
     */
    const withLast = (base: PatternSegment[], date: string): PatternSegment[] => {
      if (narrow || !date) return base;
      const tail = [sep(), quiet(`${tr(lang, "journal.patterns.last")} ${date.slice(5)}`)];
      return segW(base) + segW(tail) <= budget ? [...base, ...tail] : base;
    };

    const joinClauses = (clauses: PatternSegment[][]): PatternSegment[] => {
      const out: PatternSegment[] = [];
      for (const clause of clauses) {
        if (clause.length === 0) continue;
        if (out.length > 0) out.push(sep());
        out.push(...clause);
      }
      return out;
    };

    // ── S1 觀象 — the field of sixty-four ──
    rule(tr(lang, "journal.patterns.head"), { fg: t.primary, bold: true });
    if (patterns.total === 0 || !patterns.cadence) {
      blank();
      row({ text: tr(lang, "journal.patterns.noData"), style: { fg: t.secondary } });
      return rows;
    }

    const cadence = patterns.cadence;
    const div = patterns.diversity;
    const methods = patterns.baseline.methods;

    const a1 = joinClauses([
      [num(String(patterns.total)), lab(` ${tr(lang, "journal.countSuffix")}`)],
      [num(String(cadence.spanDays)), lab(tr(lang, "journal.patterns.days"))],
      [lab(`${tr(lang, "journal.patterns.activeDays")} `), num(String(cadence.activeDays))],
    ]);
    const a2 = [
      lab(`${tr(lang, "journal.patterns.seenOf")} `),
      num(String(div.distinctHexagrams)),
      lab(` ${tr(lang, "journal.patterns.ofSixtyFour")}`),
      ...chance(div.expectedDistinctHexagrams),
    ];
    const a3 =
      patterns.total < 2
        ? []
        : [
            lab(`${tr(lang, "journal.patterns.recurrence")} `),
            // Observed counts all readings (matches a2's 'seen N of 64' and the
            // lit field); div.observedRepeats is the method-marked-only subset
            // kept internally for repeatLift, and would read ×0 on legacy
            // journals that visibly recur. The chance figure stays known-based,
            // covered by the same footnote as a2.
            num(`×${patterns.total - div.distinctHexagrams}`),
            ...chance(div.expectedRepeats),
          ];
    const a4 = joinClauses([
      [lab(`${tr(lang, "journal.patterns.thisMonth")} `), num(String(patterns.thisMonth))],
      [lab(`${tr(lang, "journal.patterns.recent30")} `), num(String(cadence.recent30))],
      cadence.idleDays !== null
        ? [
            lab(`${tr(lang, "journal.patterns.idle")} `),
            num(String(cadence.idleDays)),
            lab(tr(lang, "journal.patterns.days")),
          ]
        : [],
    ]);
    const a5 = joinClauses([
      [
        num(formatNumber(cadence.castsPerActiveDay, 1)),
        lab(tr(lang, "journal.patterns.perActiveDay")),
      ],
      cadence.medianGapDays !== null
        ? [
            lab(`${tr(lang, "journal.patterns.usualGap")} `),
            num(formatNumber(cadence.medianGapDays, cadence.medianGapDays % 1 === 0 ? 0 : 1)),
            lab(tr(lang, "journal.patterns.days")),
          ]
        : [],
      cadence.longestGapDays !== null
        ? [
            lab(`${tr(lang, "journal.patterns.longestGap")} `),
            num(String(cadence.longestGapDays)),
            lab(tr(lang, "journal.patterns.days")),
          ]
        : [],
    ]);
    const a6 = joinClauses([
      [lab(`${tr(lang, "journal.patterns.coin")} `), num(String(methods.coin))],
      [lab(`${tr(lang, "journal.patterns.yarrow")} `), num(String(methods.yarrow))],
      methods.unknown > 0
        ? [lab(`${tr(lang, "journal.patterns.methodUnmarked")} `), num(String(methods.unknown))]
        : [],
    ]);
    // Legend marks mirror the grid's tier styles exactly; the accent mark
    // teaches the recency channel by showing the accent token itself.
    const legend: PatternSegment[] = [
      { text: "○", style: { fg: t.dimmed } },
      lab(` ${tr(lang, "journal.patterns.legendNever")}  `),
      { text: "◦", style: { fg: t.tertiary } },
      lab(` ${tr(lang, "journal.patterns.legendOnce")}  `),
      { text: "◐", style: { fg: t.secondary } },
      lab(` ${tr(lang, "journal.patterns.legendFew")}  `),
      { text: "●", style: { fg: t.primary, bold: true } },
      lab(` ${tr(lang, "journal.patterns.legendOften")}  `),
      { text: "◉", style: { fg: t.accent, bold: true } },
      lab(` ${tr(lang, "journal.patterns.legendNow")}`),
    ];
    const annotations: PatternSegment[][] = [a1, a2, a3, a4, a5, a6, [], legend];

    // Two channels, no extra glyph: brightness encodes how often a hexagram
    // has come up; the single accent is reserved for the most recent reading
    // (recency = attention), styled on the glyph itself — never a prefix mark,
    // which would read as a cursor on a game board.
    const tierStyle = (count: number): TextStyle => {
      if (count === 0) return { fg: t.dimmed, dim: mono };
      if (count === 1) return { fg: t.tertiary };
      if (count <= 3) return { fg: t.secondary };
      return { fg: t.primary, bold: true };
    };

    // The field is 8 width-2 glyphs + 7 two-col gaps = 30 cols from the left
    // margin (col 2), then a 4-col gutter before annotations begin at col 36.
    // Reflow the day's facts to full rows beneath the grid whenever the widest
    // of them would clip beside it — a measured threshold, so zh (narrow
    // labels) stays side-by-side where en (wider, with pinyin) must drop down.
    const annoStart = 2 + 30 + 4;
    const maxAnnoW = annotations.reduce(
      (m, ann) => Math.max(m, ann.reduce((sum, seg) => sum + stringWidth(seg.text), 0)),
      0,
    );
    const reflowField = annoStart + maxAnnoW > ctx.cols;

    for (let r = 0; r < 8; r++) {
      const segs: PatternSegment[] = [];
      for (let c = 0; c < 8; c++) {
        const kw = r * 8 + c + 1;
        const style =
          kw === patterns.field.recent
            ? { fg: t.accent, bold: true }
            : tierStyle(patterns.field.counts[kw - 1]);
        segs.push({ text: GUA[kw - 1].u, style });
        if (c < 7) segs.push({ text: "  ", style: stSep });
      }
      if (!reflowField && annotations[r].length > 0) {
        segs.push({ text: "    ", style: stLabel }, ...annotations[r]);
      }
      rows.push({ segments: segs });
    }
    if (reflowField) {
      for (const ann of annotations) rows.push({ segments: ann });
    }

    // One quiet footnote names what the chance figures rest on (or why
    // they are withheld). Aligned to the value column when beside the grid.
    const footPad = reflowField ? "" : " ".repeat(LABEL_W + 1);
    if (methods.known === 0) {
      row(quiet(footPad + tr(lang, "journal.patterns.noBaseline")));
    } else if (!gate) {
      row(quiet(footPad + tr(lang, "journal.patterns.tooFew")));
    } else if (methods.unknown > 0) {
      row(
        quiet(
          footPad +
            `${tr(lang, "journal.patterns.baselineRestPre")}${methods.known}${tr(lang, "journal.patterns.baselineRestPost")}`,
        ),
      );
    }

    // ── S2 卦象 — faces seen ──
    if (patterns.topHexagrams.length > 0) {
      blank();
      // The per-hexagram expectation is uniform (known/64), so it belongs once
      // in the rule — not repeated identically down every row — matching the
      // 爻象/八卦 shared-note idiom.
      const perHex = patterns.baseline.primaryExpectedPerHexagram;
      rule(
        tr(lang, "journal.patterns.sectionFaces"),
        { fg: t.secondary, bold: true },
        gate && perHex !== null
          ? `${tr(lang, "journal.patterns.eachByChance")}${chanceNum(perHex)}`
          : undefined,
      );
      const maxFace = Math.max(...patterns.topHexagrams.map((hex) => hex.count));
      for (const hex of patterns.topHexagrams.slice(0, 5)) {
        const gua = GUA[hex.kw - 1];
        if (!gua) continue;
        const labelSegs: PatternSegment[] = [{ text: `${gua.u} ${cn(gua.n)}`, style: stName }];
        if (lang === "en") labelSegs.push(lab(` ${gua.p}`));
        row(
          ...withLast(
            [
              ...label(labelSegs),
              ...bar(hex.count, maxFace),
              lab(" "),
              num(`×${hex.count}`),
            ],
            hex.lastDate,
          ),
        );
      }
    }

    // ── S3 爻象 — where movement falls ──
    blank();
    rule(
      tr(lang, "journal.patterns.sectionLines"),
      { fg: t.secondary, bold: true },
      gate
        ? `${tr(lang, "journal.patterns.eachLine")} · ${tr(lang, "journal.patterns.chanceSays")}${formatNumber(methods.known / 4, 1)}`
        : undefined,
    );
    const totalMoving = patterns.movingLines.reduce((sum, line) => sum + line.count, 0);
    if (totalMoving === 0) {
      row(lab(" ".repeat(LABEL_W + 1)), {
        text: tr(lang, "journal.patterns.noMovement"),
        style: { fg: t.secondary },
      });
      if (gate) {
        // Stillness weighed against chance is itself the observation.
        row(
          ...label([lab(tr(lang, "journal.patterns.still"))]),
          num(`×${patterns.total}`),
          sep(),
          lab(
            `${tr(lang, "journal.patterns.chanceSays")}${formatNumber(patterns.movingLineCounts[0].expected, 1)}`,
          ),
        );
      }
    } else {
      const maxLine = Math.max(...patterns.movingLines.map((line) => line.count));
      // Top-down, the way a hexagram is read: line 6 first.
      for (let pos = 6; pos >= 1; pos--) {
        const line = patterns.movingLines[pos - 1];
        row(
          ...label([lab(tr(lang, LINE_KEYS[pos - 1]))]),
          ...bar(line.count, maxLine),
          lab(" "),
          num(`×${String(line.count).padStart(2)}`),
        );
      }
      const shownBins = patterns.movingLineCounts.filter((bin) => bin.count > 0);
      row(
        ...label([lab(tr(lang, "journal.patterns.movedPerCast"))]),
        ...shownBins.flatMap((bin) => [
          lab(`${bin.movingLines} `),
          num(padToWidth(`×${bin.count}`, 6)),
        ]),
      );
      if (gate) {
        // A rare bin (six lines moving ≈ 0.002 expected) must not strip to
        // '~0' beside a real observation — say '<0.1', not an exact zero.
        const approx = (v: number): string =>
          v > 0 && v < 0.1 ? "<0.1" : `~${formatNumber(v, 1)}`;
        row(
          ...label([quiet(tr(lang, "journal.patterns.chance"))]),
          ...shownBins.map((bin) => quiet(padToWidth(approx(bin.expected), 8))),
        );
      }
    }
    if (gate) {
      row(
        ...label([lab(tr(lang, "journal.patterns.oldYangLabel"))]),
        num(`×${patterns.baseline.oldYang.observed}`),
        sep(),
        lab(
          `${tr(lang, "journal.patterns.chanceSays")}${chanceNum(patterns.baseline.oldYang.expected)}`,
        ),
      );
      row(
        ...label([lab(tr(lang, "journal.patterns.oldYinLabel"))]),
        num(`×${patterns.baseline.oldYin.observed}`),
        sep(),
        lab(
          `${tr(lang, "journal.patterns.chanceSays")}${chanceNum(patterns.baseline.oldYin.expected)}`,
        ),
      );
    }

    // ── S4 八卦 — trigrams ──
    if (patterns.topTrigrams.length > 0) {
      blank();
      rule(
        tr(lang, "journal.patterns.sectionTrigrams"),
        { fg: t.secondary, bold: true },
        // Uniform geometry, not method probability — survives a missing
        // baseline. The marker (~ / 約) rides the catalog value, like chanceSays,
        // so zh doesn't double it (各依理數約2.3, not 各依理數約 ~2.3).
        patterns.total >= 8
          ? `${tr(lang, "journal.patterns.eachByChance")}${formatNumber(patterns.topTrigrams[0].expected, 1)}`
          : undefined,
      );
      const maxTri = Math.max(...patterns.topTrigrams.map((tri) => tri.count));
      for (const tri of patterns.topTrigrams.slice(0, 3)) {
        const info = TRIGRAMS[tri.index];
        if (!info) continue;
        const labelSegs: PatternSegment[] = [{ text: `${info.sym} ${cn(info.n)}`, style: stName }];
        if (lang === "en") labelSegs.push({ text: ` ${info.img}`, style: { fg: t.secondary } });
        row(
          ...label(labelSegs),
          ...bar(tri.count, maxTri),
          lab(" "),
          num(`×${tri.count}`),
          sep(),
          lab(`${tr(lang, "journal.patterns.role")} ${tri.upperCount}/${tri.lowerCount}`),
        );
      }
    }

    // ── shared glyph+name grammar for S5/S6 (spaced, matching S2 faces) ──
    const guaName = (kw: number): string => {
      const gua = GUA[kw - 1];
      return gua ? `${gua.u} ${cn(gua.n)}` : String(kw);
    };
    const pairLabel = (from: number, to: number): PatternSegment[] => {
      if (!GUA[from - 1] || !GUA[to - 1]) return [lab(`${from}→${to}`)];
      return [
        { text: guaName(from), style: stName },
        { text: " → ", style: stLabel },
        { text: guaName(to), style: stName },
      ];
    };
    const repeated = (pairs: typeof patterns.topTransitions): typeof patterns.topTransitions =>
      pairs.filter((pair) => pair.count >= 2).slice(0, 2);

    // ── S5 次第 — one cast to the next ──
    const transitions = repeated(patterns.topTransitions);
    if (patterns.total >= 2 && (transitions.length > 0 || patterns.hammingDrift)) {
      blank();
      rule(tr(lang, "journal.patterns.sectionSuccession"), { fg: t.secondary, bold: true });
      for (const pair of transitions) {
        row(...withLast([...label(pairLabel(pair.from, pair.to)), num(`×${pair.count}`)], pair.lastDate));
      }
      const drift = patterns.hammingDrift;
      if (drift) {
        const maxBin = Math.max(...drift.distribution.map((bin) => bin.count));
        const spark = drift.distribution.flatMap((bin, i): PatternSegment[] => [
          ...(i > 0 ? [lab(" ")] : []),
          quiet(String(bin.distance)),
          bin.count > 0
            ? {
                text: SPARK_BLOCKS[
                  Math.max(0, Math.min(7, Math.round((bin.count / maxBin) * 8) - 1))
                ],
                style: stBar,
              }
            : { text: "·", style: { fg: t.dimmed } },
        ]);
        row(
          ...label([lab(tr(lang, "journal.patterns.castToCast"))]),
          ...spark,
          sep(),
          lab(tr(lang, "journal.patterns.linesDiffer")),
          sep(),
          lab(`${tr(lang, "journal.patterns.mean")} `),
          num(formatNumber(drift.mean, 1)),
          lab("/6"),
        );
      }
    }

    // ── S6 卦變 — turnings & echoes ──
    const transformations = repeated(patterns.topTransformations);
    const echoes = patterns.topStructuralEchoes.filter((echo) => echo.count >= 2).slice(0, 3);
    if (transformations.length > 0 || echoes.length > 0) {
      blank();
      rule(tr(lang, "journal.patterns.sectionTurnings"), { fg: t.secondary, bold: true });
      for (const pair of transformations) {
        row(...withLast([...label(pairLabel(pair.from, pair.to)), num(`×${pair.count}`)], pair.lastDate));
      }
      for (const echo of echoes) {
        const valueSegs: PatternSegment[] = [];
        if (echo.kind === "kingWenPair" && echo.pairStart !== undefined && echo.pairEnd !== undefined) {
          if (GUA[echo.pairStart - 1] && GUA[echo.pairEnd - 1]) {
            valueSegs.push({ text: guaName(echo.pairStart), style: stName }, sep(), {
              text: guaName(echo.pairEnd),
              style: stName,
            });
          } else {
            valueSegs.push(lab(`${echo.pairStart}/${echo.pairEnd}`));
          }
        } else if (echo.kw !== undefined) {
          const gua = GUA[echo.kw - 1];
          if (gua) {
            valueSegs.push({ text: guaName(echo.kw), style: stName });
            if (lang === "en") valueSegs.push(lab(` ${gua.p}`));
          } else {
            valueSegs.push(lab(String(echo.kw)));
          }
        }
        row(
          ...withLast(
            [
              ...label([lab(structuralEchoLabel(echo.kind, lang))]),
              ...valueSegs,
              lab(" "),
              num(`×${echo.count}`),
            ],
            echo.lastDate,
          ),
        );
      }
    }

    // ── 兩儀 — the yang/yin balance, a coda that grows from a still axis ──
    const balance = patterns.lineBalance;
    if (balance.yang + balance.yin > 0) {
      blank();
      rule(tr(lang, "journal.patterns.sectionBalance"), { fg: t.secondary, bold: true });
      const armW = Math.max(4, Math.min(11, barW - 1));
      const peak = Math.max(balance.yang, balance.yin, 1);
      const arm = (n: number): number => (n <= 0 ? 0 : Math.max(1, Math.round((n / peak) * armW)));
      const yinArm = arm(balance.yin);
      const yangArm = arm(balance.yang);
      // 陰 darker, 陽 lighter; both grow from the central axis outward.
      const yinFill: TextStyle = { fg: t.tertiary };
      const yangFill: TextStyle = { fg: t.secondary };
      row(
        ...label([]),
        { text: "⚋ ", style: yinFill },
        { text: "▁".repeat(armW - yinArm), style: stRest },
        { text: "▅".repeat(yinArm), style: yinFill },
        { text: "│", style: stSep },
        { text: "▅".repeat(yangArm), style: yangFill },
        { text: "▁".repeat(armW - yangArm), style: stRest },
        { text: " ⚊", style: yangFill },
        lab("  "),
        lab(`${tr(lang, "journal.patterns.balanceYin")} `),
        num(String(balance.yin)),
        sep(),
        lab(`${tr(lang, "journal.patterns.balanceYang")} `),
        num(String(balance.yang)),
      );
    }

    return rows;
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
      footer = `[↑↓] ${tr(lang, "verb.scroll")} · [esc] ${tr(lang, "verb.back")}`;
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
      const stride = Math.max(1, this.scroll.viewportHeight);
      if (key.direction === "up") {
        this.cursor = Math.max(0, this.cursor - stride);
      } else {
        this.cursor = Math.min(Math.max(0, this.filtered.length - 1), this.cursor + stride);
      }
      // The ScrollableRegion holds no content lines (the list renders from
      // `filtered` directly), so its pageUp/pageDown scroll math would no-op
      // and let the selection leave the viewport — walk the offset from the
      // cursor instead, same as the arrow path.
      this.ensureCursorVisible();
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
      this.commitNote(entry, { text, date });
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
      // A pasted reflection arrives as one block — sanitize it whole.
      const text = sanitizeFieldText(key.text);
      if (text.length > 0) this.noteInput.insert(text);
      return;
    }
    if (key.type === "char") {
      // Decoded C1 controls (e.g. U+0085) arrive as char events — drop them.
      const ch = sanitizeFieldText(key.char);
      if (ch.length > 0) this.noteInput.insert(ch);
      return;
    }
  }

  /**
   * Attach a committed note to its entry and ride the persistence callback
   * honestly: a promise-returning onNote marks the note pending (rendered
   * dim) until the append settles — kept on success, withdrawn on failure
   * with one calm line in the preview row. In-flight appends are awaited by
   * exit() so a commit immediately followed by leaving the scene still
   * reaches disk.
   */
  private commitNote(entry: JournalEntryView, note: JournalNoteView): void {
    this.failedNoteEntries.delete(entry);
    entry.notes = [...(entry.notes ?? []), note];
    const result = this.opts.onNote?.(entry, note.text);
    if (!result) {
      note.state = "saved"; // synchronous persistence (or none wired)
      return;
    }
    note.state = "pending";
    const settle = result.then(
      () => {
        note.state = "saved";
      },
      () => {
        // The bytes never landed — withdrawing the marker is the honest render.
        entry.notes = (entry.notes ?? []).filter((n) => n !== note);
        this.failedNoteEntries.add(entry);
      },
    );
    this.inFlightNotes.add(settle);
    void settle.finally(() => this.inFlightNotes.delete(settle));
  }

  private handlePatternsKey(key: KeyEvent): SceneSignal | void {
    if (key.type === "char" && key.char === "k") {
      this.patternsScroll.scrollUp();
      return;
    }
    if (key.type === "char" && key.char === "j") {
      this.patternsScroll.scrollDown();
      return;
    }
    if (key.type === "arrow") {
      if (key.direction === "up") this.patternsScroll.scrollUp();
      if (key.direction === "down") this.patternsScroll.scrollDown();
      return;
    }
    if (key.type === "page") {
      if (key.direction === "up") this.patternsScroll.pageUp();
      if (key.direction === "down") this.patternsScroll.pageDown();
      return;
    }
    if (key.type === "home") {
      this.patternsScroll.scrollToTop();
      return;
    }
    if (key.type === "end") {
      this.patternsScroll.scrollToBottom();
      return;
    }
    if (key.type === "escape" || (key.type === "char" && (key.char === "p" || key.char === "q"))) {
      this.patternsOpen = false;
      this.patternsScroll.scrollToTop();
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
      const text = sanitizeFieldText(key.text);
      if (text.length > 0) {
        this.searchInput.insert(text);
        this.setQuery(this.searchInput.value);
      }
      return;
    }
    if (key.type === "char") {
      const ch = sanitizeFieldText(key.char);
      if (ch.length > 0) {
        this.searchInput.insert(ch);
        this.setQuery(this.searchInput.value);
      }
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

function formatNumber(value: number, digits: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

/**
 * Pad to a display-column width. String.padEnd counts UTF-16 code units, so a
 * label holding a hexagram glyph or CJK name would land 1–2 columns short and
 * break the pane's shared value column — pad by stringWidth instead.
 */
function padToWidth(text: string, width: number): string {
  const w = stringWidth(text);
  return w >= width ? text : text + " ".repeat(width - w);
}

function structuralEchoLabel(kind: StructuralEcho["kind"], lang: DisplayLanguage): string {
  switch (kind) {
    case "nuclear":
      return tr(lang, "journal.patterns.nuclear");
    case "polarity":
      return tr(lang, "journal.patterns.polarity");
    case "mirror":
      return tr(lang, "journal.patterns.mirror");
    case "kingWenPair":
      return tr(lang, "journal.patterns.kingWenPair");
  }
}

/** Local YYYY-MM-DD (default for the injected `today`). */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
