// Journal query helpers — per-hexagram history lookup + note attachment

import type { HistoryEntry, ReflectionNote } from "@iching/core";
import type { JournalStore } from "./journal-store.js";

export interface HexagramHistory {
  castCount: number;
  lastCastDate: string | null;
  dates: string[];
}

/** Scan journal for all casts of a specific hexagram by KW number */
export async function getHexagramHistory(
  store: JournalStore,
  kwNumber: number,
): Promise<HexagramHistory> {
  const dates: string[] = [];

  for await (const entry of store.stream()) {
    if (entry.cast.primary === kwNumber) {
      dates.push(entry.date);
    }
  }

  // The latest date is the MAX, not the last appended — a journal may hold
  // out-of-order entries (imported, merged, or hand-edited), and the patterns
  // pane derives its per-hexagram "last" the same way (max over dates). Taking
  // the append-tail here would make the dictionary and the pane disagree on
  // when a hexagram was last drawn.
  return {
    castCount: dates.length,
    lastCastDate: dates.length > 0 ? dates.reduce((max, d) => (d > max ? d : max)) : null,
    dates,
  };
}

/** A history entry with its reflection notes attached (append order). */
export interface AnnotatedEntry extends HistoryEntry {
  notes: ReflectionNote[];
}

/**
 * The durable pointer a reflection note uses to find its reading. A timestamp
 * uniquely identifies a modern reading. A legacy timestamp-less reading has no
 * unique field, so several casts on one day all share the bare date — annotating
 * a non-last one would silently re-attach the note to the day's last cast. So
 * disambiguate those by cast CONTENT (`date#primary.becoming.changing`): an
 * order-independent key that re-finds the SAME reading whether the journal is
 * streamed append-first (CLI) or newest-first (TUI). Only truly-identical
 * same-day readings collide, and those are indistinguishable anyway.
 */
export function entryNoteRef(entry: HistoryEntry): string {
  if (entry.timestamp) return entry.timestamp;
  const c = entry.cast;
  const changing = [...c.changingPositions].sort((a, b) => a - b).join("-");
  return `${entry.date}#${c.primary}.${c.becoming ?? 0}.${changing}`;
}

/**
 * True when `note.ref` points at `entry`. Matches the precise content ref
 * (entryNoteRef) AND the bare `timestamp ?? date` key, so notes written before
 * the content ref existed (a plain date, resolving to the day's last cast) keep
 * attaching exactly as they did.
 */
export function noteMatchesEntry(note: ReflectionNote, entry: HistoryEntry): boolean {
  return note.ref === entryNoteRef(entry) || note.ref === (entry.timestamp ?? entry.date);
}

/**
 * Load all entries with their reflection notes attached. Notes reference a
 * reading by its timestamp (falling back to its date); a date ref that
 * matches several same-day readings attaches to the last one of that day.
 * Existing entry fields pass through unchanged — callers that only know
 * HistoryEntry keep working.
 */
export async function loadEntriesWithNotes(
  store: JournalStore,
): Promise<AnnotatedEntry[]> {
  const entries: AnnotatedEntry[] = [];
  const byRef = new Map<string, AnnotatedEntry>();

  for await (const entry of store.stream()) {
    const annotated: AnnotatedEntry = { ...entry, notes: [] };
    entries.push(annotated);
    // The precise content/timestamp ref (entryNoteRef) re-finds the EXACT
    // reading, so a TUI note on one of several same-day legacy casts stays put.
    byRef.set(entryNoteRef(entry), annotated);
    // Plus the bare date key for legacy plain-date refs: later same-key entries
    // win, so a date ref still lands on the day's last cast, exactly as before.
    if (!entry.timestamp) byRef.set(entry.date, annotated);
  }

  for await (const note of store.streamNotes()) {
    const target = byRef.get(note.ref);
    if (target) target.notes.push(note);
    // Orphan notes (their reading's line was torn) are dropped quietly —
    // the journal stays readable either way.
  }

  return entries;
}
