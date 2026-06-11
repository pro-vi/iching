import type { HistoryEntry } from "@iching/core";
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

  /** Stream entries, optionally filtered by query (skipping torn lines) */
  stream(query?: HistoryQuery): AsyncIterable<HistoryEntry>;

  /** Return the most recently appended readable entry, or null */
  latest(): Promise<HistoryEntry | null>;
}
