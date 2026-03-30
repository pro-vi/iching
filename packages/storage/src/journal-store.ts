import type { HistoryEntry } from "@iching/core";
import type { HistoryQuery } from "./types.js";

/** Append-only journal of daily readings */
export interface JournalStore {
  /** Append a single history entry as one JSONL line */
  append(entry: HistoryEntry): Promise<void>;

  /** Stream entries, optionally filtered by query */
  stream(query?: HistoryQuery): AsyncIterable<HistoryEntry>;

  /** Return the most recently appended entry, or null */
  latest(): Promise<HistoryEntry | null>;
}
