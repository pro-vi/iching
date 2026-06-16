// JournalScene — scrollable timeline of past readings, and an instrument of
// reflection: incremental search over intentions and hexagram names ([/]),
// reflection notes attached to past readings ([n]), a door into the
// dictionary for the selected entry ([g]), and a quiet patterns pane over
// everything cast so far ([p]).

import type { Scene, SceneContext, SceneSignal } from "../../scene/types.ts";
import type { CellBuffer } from "../../render/buffer.ts";
import type { KeyEvent } from "../../input/key-parser.ts";
import type { DisplayLanguage, HistoryEntry } from "@iching/core";
import { GUA, TRIGRAMS, entryTimeKey, stripTerminalControls, toSimplified } from "@iching/core";
import { getTheme } from "../../color/theme.ts";
import { stringWidth, truncateToWidth, fitLine } from "../../layout/measure.ts";
// Re-exported for callers that have long imported it from here (e.g. tests).
export { truncateToWidth };
import { ScrollableRegion } from "../../widgets/scrollable.ts";
import { TextInput } from "../../widgets/text-input.ts";
import { tr, countUnit, type MessageKey } from "../../i18n/messages.ts";
import {
  computeJournalPatterns,
  type DirectionComparison,
  type JournalPatterns,
  type PairFrequency,
  type StructuralEcho,
} from "@iching/core";

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
// widest en faces label across all 64 hexagrams — 「䷡ 大壯 Dà Zhuàng」. Exported
// so a test can assert no label outgrows it: label() pads by max(1, …), so a
// wider label silently shifts that row's value column out of alignment (it has
// no guardrail of its own — external render review, H4).
export const LABEL_W = 17;
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
   * append is in flight (rendered dim), "saved" once it lands, "failed" if the
   * bytes never reached disk. A failed attempt is KEPT in the entry's note list
   * (in commit order) but excluded from the list marker and search; the preview
   * shows the failure only when the failed note is the entry's latest — so a
   * later successful note is never masked by an earlier failure. Notes loaded
   * from disk carry no state — they are already durable.
   */
  state?: "pending" | "saved" | "failed";
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
export function entryMatchesQuery(entry: JournalEntryView, query: string): boolean {
  const q = normalize(query.trim());
  if (q.length === 0) return true;
  if (entry.intention && normalize(entry.intention).includes(q)) return true;
  if (hexagramMatches(entry.cast.primary, q)) return true;
  if (entry.cast.becoming !== null && hexagramMatches(entry.cast.becoming, q)) return true;
  // A reflection note is the richest thing you write about a reading — find a
  // cast by what you later made of it, not only the question you first asked.
  // A failed attempt never reached disk, so it is not searchable.
  if (entry.notes?.some((n) => n.state !== "failed" && normalize(n.text).includes(q))) return true;
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

  // [p] patterns pane. The derivation is pure over (cast-set, today), so it is
  // memoized — the 30 FPS loop must not recompute it every frame (≈3ms/frame
  // over a 2000-reading journal). The key carries BOTH today (midnight rollover)
  // and the reading count: `entries` is append-only for casts (reflection notes
  // land in entry.notes, which the cast-based derivation ignores, so they leave
  // the count — and the cache — untouched), and a new cast bumps the length,
  // invalidating precisely when the patterns would actually change. Keying on
  // the count rather than the stable reference keeps the cache correct even if
  // a future caller mutates the array in place instead of constructing afresh
  // (external review, GPT-Pro: a date-only key is a latent same-day staleness
  // vector if that invariant ever breaks).
  private patternsOpen = false;
  private cachedPatterns: JournalPatterns | null = null;
  private cachedPatternsKey = "";

  // Reflection-note persistence honesty: appends still in flight, awaited by
  // exit() so scene teardown can't lose a pending write. (Failure is recorded
  // per-note via note.state === "failed", not per-entry, so a later success on
  // the same entry can't be masked.)
  private inFlightNotes = new Set<Promise<void>>();

  constructor(entries: JournalEntryView[], opts: JournalSceneOptions = {}) {
    // Most recent first. Drop any entry without a usable cast at the boundary
    // (storage validates, so this is defense-in-depth): every downstream site —
    // the list row, the field, the patterns derivation — indexes cast.primary,
    // and one cast-less record must not take the whole scene down.
    // Newest first — ordered by the SAME time-key the patterns pane uses for
    // its ◉ recency accent, so the list's top row and the accent always mark
    // the same reading (a .reverse() would assume strictly chronological append
    // order and disagree with the pane on an out-of-order / imported journal).
    // Stable on equal keys → same-day undated casts keep their append order.
    this.entries = entries
      .filter((e) => e?.cast != null && typeof e.cast.primary === "number")
      .sort((a, b) => entryTimeKey(b).localeCompare(entryTimeKey(a)));
    this.filtered = this.entries;
    this.cursor = 0;
    this.scroll = new ScrollableRegion(20, []);
    this.patternsScroll = new ScrollableRegion(20, []);
    this.opts = opts;
    this.searchInput = new TextInput();
    this.noteInput = new TextInput();
  }

  enter(ctx: SceneContext): void {
    // Floor every viewport at one row, exactly as resize() and the patterns
    // scroll already do — a sub-chrome terminal (rows ≤ 4) would otherwise seed
    // the list scroll with a ≤0 height and feed that into the cursor-visibility
    // math until the first resize corrects it.
    this.scroll.viewportHeight = Math.max(1, ctx.rows - 4); // header(2) + preview + footer
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

  resize(_cols: number, rows: number): void {
    this.scroll.viewportHeight = Math.max(1, rows - 4);
    // A shrink can leave the selection below the new fold: the patterns scroll
    // re-clamps itself (scrollDown(0)), but the list cursor needs the same
    // care, or the highlighted reading vanishes off the bottom until the user
    // arrows it back. Re-run the cursor-into-view math the move keys use.
    this.ensureCursorVisible();
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

    const countText = `${this.filtered.length} ${countUnit(lang, this.filtered.length, "journal.countSuffix")}`;
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
      const midRow = Math.floor(ctx.rows / 2);
      const empty = tr(lang, "journal.empty");
      const emptyCol = Math.max(0, Math.floor((maxW - stringWidth(empty)) / 2));
      frame.writeText(midRow, emptyCol, empty, { fg: t.secondary });
      // A quieter line beneath orients what this space holds — but only when it
      // clears the footer (a sub-chrome height would otherwise overwrite it).
      const invite = tr(lang, "journal.emptyInvite");
      const inviteRow = midRow + 1;
      if (inviteRow < ctx.rows - 1) {
        const inviteCol = Math.max(0, Math.floor((maxW - stringWidth(invite)) / 2));
        frame.writeText(inviteRow, inviteCol, invite, { fg: t.tertiary, dim: true });
      }
      this.renderFooter(frame, ctx, lang); // with no readings, still show the way out
      return;
    }

    // A live search that matches nothing — a quiet centered hint (and how to
    // clear it) instead of a bare blank list, the same grace the dict offers.
    // filtered is only empty while searching (otherwise it mirrors entries).
    if (this.filtered.length === 0) {
      const hint = tr(lang, "journal.emptyHint");
      const hintCol = Math.max(0, Math.floor((maxW - stringWidth(hint)) / 2));
      frame.writeText(Math.floor(ctx.rows / 2), hintCol, hint, { fg: t.tertiary, dim: true });
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

      // Intention — a 30-column budget (CJK counts double)
      if (entry.intention) {
        // Strip control sequences from stored text at the render boundary: a
        // hand-edited / synced / imported journal can carry escapes the TUI
        // input path never sanitized. The cell buffer drops width-0 controls
        // by accident (they get overwritten in-column), but that is luck, not
        // a defense — make it explicit, as the plain digest already does.
        line += `  “${truncateToWidth(stripTerminalControls(entry.intention), 30)}”`;
      }

      // Quiet marker for annotated entries (·註 / ·note). It is a STRUCTURAL
      // signal — "this reading carries a reflection" — not content, so reserve
      // its width and append it AFTER truncation. A long intention then clips
      // with an ellipsis instead of pushing the marker off the row end, where
      // it would vanish silently and the row would read as un-annotated.
      const noteMarker = entry.notes?.some((n) => n.state !== "failed")
        ? `  ·${tr(lang, "journal.noteMarker")}`
        : "";

      // Truncate the content to the viewport budget, holding room for the marker.
      line = truncateToWidth(line, maxW - 4 - stringWidth(noteMarker)) + noteMarker;

      const col = 3;
      const cursor = isSelected ? " > " : "   ";
      const fg = isSelected ? t.primary : t.secondary;
      const cursorFg = isSelected ? t.accent : t.tertiary;

      frame.writeText(row, 0, cursor, { fg: cursorFg });
      frame.writeText(row, col, line, { fg, bold: isSelected });
    }

    // Scroll indicator — right-anchored on the preview row (rows-2). The
    // preview reserves this width (see renderPreviewRow) so the two never clash.
    const indicator = this.scrollIndicatorText(ctx.rows);
    if (indicator) {
      frame.writeText(ctx.rows - 2, maxW - stringWidth(indicator) - 1, indicator, { fg: t.tertiary });
    }
  }

  /** The list position indicator ("3/26 (40%)"), or null when the list fits. */
  private scrollIndicatorText(rows: number): string | null {
    // A viewport is at least one row. Without the floor, a terminal shorter
    // than the 4-row chrome makes `rows - 4` ≤ 0, the "list fits" guard goes
    // vacuously false even for a single entry, and the position percentage
    // divides 0/(1-1) → renders "1/1 (NaN%)". Flooring at 1 both kills that
    // NaN and reads honestly: one entry has nothing to scroll, so no indicator.
    const viewportH = Math.max(1, rows - 4);
    if (this.filtered.length <= viewportH) return null;
    const pct = Math.round((this.cursor / (this.filtered.length - 1)) * 100);
    return `${this.cursor + 1}/${this.filtered.length} (${pct}%)`;
  }

  /** Preview row (rows-2): note input > latest note > the entry's image text. */
  private renderPreviewRow(frame: CellBuffer, ctx: SceneContext, lang: DisplayLanguage): void {
    const t = getTheme();
    // The scroll indicator shares this row (right-anchored). Reserve its width
    // so a full-width image/note/input ends before it, instead of overrunning
    // and leaving a stray fragment of the indicator (e.g. a lone ')').
    const indicator = this.scrollIndicatorText(ctx.rows);
    const maxW = ctx.cols - (indicator ? stringWidth(indicator) + 2 : 0);
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
    // The latest attempt on this entry never reached disk — one calm line. Only
    // the latest note's failure surfaces, so an earlier failure can't mask a
    // later saved note (which renders below as a normal note).
    if (latestNote?.state === "failed") {
      const failed = truncateToWidth(tr(lang, "journal.noteSaveFailed"), maxW - 4);
      frame.writeText(detailRow, 2, failed, { fg: t.tertiary, dim: true });
      return;
    }

    if (latestNote) {
      // Strip control sequences from the stored note at the render boundary —
      // same reasoning as the list-row intention above (the plain digest's
      // note line already does this).
      const text = truncateToWidth(
        `·${tr(lang, "journal.noteMarker")} ${latestNote.date}  ${stripTerminalControls(latestNote.text)}`,
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

    // Image preview: English image in en mode; the 大象傳 (converted for 简) in zh modes.
    const gua = GUA[selected.cast.primary - 1];
    const detail = lang === "en" ? gua.en : lang === "zh-Hans" ? toSimplified(gua.dx) : gua.dx;
    // Truncate to fit rather than drop. Most 大象傳 lines are wider than one
    // preview row at common widths (33/64 vanish at 80 cols, every one below
    // ~60), so a fits-or-nothing guard left the row blank for most readings.
    // The opening — the natural image (大象) itself — is the evocative part and
    // survives the clip; the full text is one [enter]/[g] away.
    frame.writeText(detailRow, 2, truncateToWidth(detail, maxW - 4), { fg: t.tertiary, dim: true });
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
    const key = `${today}:${this.entries.length}`;
    if (!this.cachedPatterns || this.cachedPatternsKey !== key) {
      this.cachedPatterns = computeJournalPatterns(this.entries, today);
      this.cachedPatternsKey = key;
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
    // A stricter gate for sections whose ROW shows an all-readings count (faces
    // seen, line positions, moved-per-cast, trigrams): their by-chance figure is
    // method-marked (known/64, known/4, …), so pairing it with an all-readings
    // count overstates how far above chance a mixed journal sits — legacy/unknown
    // casts inflate the observed side of a comparison whose expected side counts
    // only method-marked casts. We can't assume an unknown cast's distribution,
    // so only show those chance figures when EVERY reading is method-marked
    // (then all-count == known-count and the comparison is honest). Direction and
    // diversity already display the method-marked observed, so they keep `gate`.
    const gatePure = gate && patterns.baseline.methods.known === patterns.baseline.methods.total;
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
      gatePure && v !== null
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
      [num(String(patterns.total)), lab(` ${countUnit(lang, patterns.total, "journal.countSuffix")}`)],
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
    // Reflow when the widest annotation won't fit beside the field within the
    // SAME budget the row renderer enforces. annoStart is absolute (from col 0);
    // the renderer measures `used` from col 2, so the annotation begins at
    // used-column annoStart - 2. Comparing against ctx.cols rather than `budget`
    // let a one-column tail slip past the reflow gate and then get ellipsis-
    // clipped beside the field — at a single boundary width per language (en 78,
    // zh 74), the field legend lost its last token to a stray "…".
    const reflowField = annoStart - 2 + maxAnnoW > budget;

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
        gatePure && perHex !== null
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
      gatePure
        ? `${tr(lang, "journal.patterns.eachLine")} · ${tr(lang, "journal.patterns.chanceSays")}${formatNumber(methods.known / 4, 1)}`
        : undefined,
    );
    const totalMoving = patterns.movingLines.reduce((sum, line) => sum + line.count, 0);
    if (totalMoving === 0) {
      row(lab(" ".repeat(LABEL_W + 1)), {
        text: tr(lang, "journal.patterns.noMovement"),
        style: { fg: t.secondary },
      });
      if (gatePure) {
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
      if (gatePure) {
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
      // ×observed against its chance figure — the old-yang and old-yin rows
      // share one shape, differing only by label and which direction's tally.
      const directionRow = (labelKey: MessageKey, dir: DirectionComparison): void => {
        row(
          ...label([lab(tr(lang, labelKey))]),
          num(`×${dir.observed}`),
          sep(),
          lab(`${tr(lang, "journal.patterns.chanceSays")}${chanceNum(dir.expected)}`),
        );
      };
      directionRow("journal.patterns.oldYangLabel", patterns.baseline.oldYang);
      directionRow("journal.patterns.oldYinLabel", patterns.baseline.oldYin);
    }

    // ── S4 八卦 — trigrams ──
    if (patterns.topTrigrams.length > 0) {
      blank();
      rule(
        tr(lang, "journal.patterns.sectionTrigrams"),
        { fg: t.secondary, bold: true },
        // The chance figure is method-marked (uniform 1/8 needs P(yang)=1/2, a
        // property of the method), while the row count is all-readings — so it
        // shows only when every reading is method-marked (gatePure), else it
        // would compare an inflated count to a method-only baseline. The marker
        // (~ / 約) rides the catalog value, like chanceSays, so zh doesn't double it.
        gatePure
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
    /** 'from → to  ×N · last MM-DD' — the shared S5/S6 directed-pair row. */
    const pairRow = (pair: PairFrequency): void => {
      row(...withLast([...label(pairLabel(pair.from, pair.to)), num(`×${pair.count}`)], pair.lastDate));
    };

    // ── S5 次第 — one cast to the next ──
    const transitions = repeated(patterns.topTransitions);
    if (patterns.total >= 2 && (transitions.length > 0 || patterns.hammingDrift)) {
      blank();
      rule(tr(lang, "journal.patterns.sectionSuccession"), { fg: t.secondary, bold: true });
      for (const pair of transitions) pairRow(pair);
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
      for (const pair of transformations) pairRow(pair);
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
        const echoLabel = label([lab(structuralEchoLabel(echo.kind, lang))]);
        const countSeg = num(`×${echo.count}`);
        // The recurrence count is the finding and must survive; the hexagram
        // name is its identity but expendable under width pressure. Show the
        // name only when the whole row fits the budget (the same fit-or-drop
        // rule withLast uses for the date) — so a narrow pane keeps "nuclear ×4"
        // rather than clipping the load-bearing count to a bare "×".
        const full = [...echoLabel, ...valueSegs, lab(" "), countSeg];
        const base = segW(full) <= budget ? full : [...echoLabel, lab(" "), countSeg];
        row(...withLast(base, echo.lastDate));
      }
    }

    // ── 時 — the phase of day a reading was recorded ──
    // A quiet footnote in the chance-free tail (kept well away from the faces/
    // lines/trigram sections and their by-chance notes): not how often, but WHEN
    // in the local day the readings fell. Circumstance, never a claim about the
    // oracle or the practitioner — sparkline shape only, no per-phase tally to
    // optimise, no streak, no target, no chance comparison. The note discloses
    // the honest population as a fraction (N/total); readings without a recorded
    // local hour are omitted, never defaulted to a false midnight.
    const tod = patterns.timeOfDay;
    if (tod) {
      blank();
      const timed =
        tod.timestamped < patterns.total
          ? `${tod.timestamped}/${patterns.total}`
          : `${tod.timestamped}`;
      rule(
        tr(lang, "journal.patterns.sectionHours"),
        { fg: t.secondary, bold: true },
        `${timed}${tr(lang, "journal.patterns.timedSuffix")}`,
      );
      const PHASE_KEYS: MessageKey[] = [
        "journal.patterns.phaseDawn",
        "journal.patterns.phaseMidday",
        "journal.patterns.phaseDusk",
        "journal.patterns.phaseNight",
      ];
      const maxPhase = Math.max(...tod.counts, 1);
      const phaseCells = tod.counts.flatMap((c, i): PatternSegment[] => [
        ...(i > 0 ? [{ text: "  ", style: stSep }] : []),
        { text: tr(lang, PHASE_KEYS[i]), style: stName },
        { text: " ", style: stLabel },
        c > 0
          ? {
              text: SPARK_BLOCKS[Math.max(0, Math.min(7, Math.round((c / maxPhase) * 8) - 1))],
              style: stBar,
            }
          : { text: "·", style: { fg: t.dimmed } },
      ]);
      row(...label([]), ...phaseCells);
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
    if (this.entries.length === 0) {
      // An empty journal offers no view/note/search/patterns — advertising them
      // would dangle dead keys. Only the way out is real, so show only that:
      // the most novice state (no readings yet) must still say how to leave.
      footer = `[esc] ${tr(lang, "verb.back")}`;
    } else if (this.noteActive) {
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
    // Center when it fits; on a narrow terminal keep the lead keybinds and
    // truncate, rather than clip both ends off a centered hint.
    const { text: shownFooter, col: footerCol } = fitLine(footer, maxW);
    frame.writeText(ctx.rows - 1, footerCol, shownFooter, { fg: t.tertiary });
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
        return { type: "openJournalReading", entry };
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
    if (key.type === "deleteWord") {
      this.noteInput.deleteWord();
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
        // The bytes never landed — mark THIS attempt failed (kept in commit
        // order). The marker and search skip failed notes, and the preview
        // shows the failure only when it is the entry's latest note, so a
        // later success on the same entry is never masked by this failure.
        note.state = "failed";
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
        return { type: "openJournalReading", entry };
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
    if (key.type === "deleteWord") {
      this.searchInput.deleteWord();
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
