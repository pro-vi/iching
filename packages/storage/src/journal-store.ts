import type { HistoryEntry, ReflectionNote } from "@iching/core";
import type { HistoryQuery } from "./types.js";

/** Append-only journal of daily readings */
export interface JournalStore {
  /**
   * Malformed (torn) lines skipped by the most recent stream() or latest()
   * read — surfaced so callers can note quietly that some lines were damaged.
   */
  readonly skippedLines: number;

  /** Append a single history entry as one JSONL line */
  append(entry: HistoryEntry): Promise<void>;

  /** Append a reflection note as one JSONL line (kind:"note") */
  appendNote(note: ReflectionNote): Promise<void>;

  /** Stream entries, optionally filtered by query (skipping torn lines) */
  stream(query?: HistoryQuery): AsyncIterable<HistoryEntry>;

  /** Stream reflection notes in append order (skipping torn lines) */
  streamNotes(): AsyncIterable<ReflectionNote>;

  /**
   * Return the most recently APPENDED readable entry, or null. The app always
   * appends in cast order, so for app-written journals this is also the
   * chronologically latest reading — which is why `journal show latest` and
   * `journal note` use it. An externally reordered/imported journal can break
   * that, where it diverges from the time-key ordering the patterns derivation
   * uses (field.recent); the cheap tail-read is kept since app data never
   * violates the invariant.
   */
  latest(): Promise<HistoryEntry | null>;
}
