import { appendFile, readFile, mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import type { HistoryEntry } from "@iching/core";
import type { HistoryQuery } from "../types.js";
import type { JournalStore } from "../journal-store.js";

/**
 * Parse one JSONL line into a HistoryEntry, or null when the line is torn or
 * malformed — invalid JSON (a partial append from a crash / power loss /
 * ENOSPC) or valid JSON that isn't entry-shaped (hand-edit damage). A single
 * bad line must never make the whole journal unreadable.
 */
function parseEntryLine(line: string): HistoryEntry | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  if (typeof record.date !== "string") return null;
  if (typeof record.cast !== "object" || record.cast === null) return null;
  return parsed as HistoryEntry;
}

export class JsonlJournalStore implements JournalStore {
  /**
   * Malformed lines skipped by the most recent stream() or latest() call.
   * Reset at the start of each read; callers may surface it as a quiet note
   * (the readings themselves remain intact on the surrounding lines).
   */
  skippedLines = 0;

  constructor(private readonly path: string) {}

  async append(entry: HistoryEntry): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const line = JSON.stringify(entry) + "\n";
    await appendFile(this.path, line, "utf-8");
  }

  async *stream(query?: HistoryQuery): AsyncIterable<HistoryEntry> {
    this.skippedLines = 0;
    if (!(await this.exists())) return;

    const rl = createInterface({
      input: createReadStream(this.path, { encoding: "utf-8" }),
      crlfDelay: Infinity,
    });

    let count = 0;
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Torn/malformed line: skip it and keep reading — never throw forever.
      const entry = parseEntryLine(trimmed);
      if (entry === null) {
        this.skippedLines++;
        continue;
      }

      // Apply since filter
      if (query?.since && entry.date < query.since) continue;

      yield entry;
      count++;

      // Apply limit
      if (query?.limit !== undefined && count >= query.limit) {
        rl.close();
        break;
      }
    }
  }

  async latest(): Promise<HistoryEntry | null> {
    this.skippedLines = 0;
    if (!(await this.exists())) return null;

    const content = await readFile(this.path, "utf-8");
    const lines = content.trimEnd().split("\n");

    // Walk backwards to find the last non-empty line that parses — a torn
    // final line (interrupted append) falls through to the previous entry.
    for (let i = lines.length - 1; i >= 0; i--) {
      const trimmed = lines[i].trim();
      if (!trimmed) continue;
      const entry = parseEntryLine(trimmed);
      if (entry === null) {
        this.skippedLines++;
        continue;
      }
      return entry;
    }

    return null;
  }

  private async exists(): Promise<boolean> {
    try {
      await stat(this.path);
      return true;
    } catch {
      return false;
    }
  }
}
