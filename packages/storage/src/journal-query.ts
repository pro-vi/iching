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

  return {
    castCount: dates.length,
    lastCastDate: dates.length > 0 ? dates[dates.length - 1] : null,
    dates,
  };
}

/** A history entry with its reflection notes attached (append order). */
export interface AnnotatedEntry extends HistoryEntry {
  notes: ReflectionNote[];
}

/** True when `note.ref` points at `entry` — by timestamp, or by date for
 *  entries written before timestamps landed. */
export function noteMatchesEntry(note: ReflectionNote, entry: HistoryEntry): boolean {
  return note.ref === (entry.timestamp ?? entry.date);
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
    // Later same-key entries win, so a date ref lands on the day's last cast.
    byRef.set(entry.timestamp ?? entry.date, annotated);
  }

  for await (const note of store.streamNotes()) {
    const target = byRef.get(note.ref);
    if (target) target.notes.push(note);
    // Orphan notes (their reading's line was torn) are dropped quietly —
    // the journal stays readable either way.
  }

  return entries;
}
