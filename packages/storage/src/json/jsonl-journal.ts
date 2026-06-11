import { appendFile, readFile, mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import type { HistoryEntry, ReflectionNote } from "@iching/core";
import type { HistoryQuery } from "../types.js";
import type { JournalStore } from "../journal-store.js";

/**
 * Classify one JSONL line:
 * - a HistoryEntry (lines without a `kind` discriminator — every record
 *   written before reflection notes landed, and every reading since);
 * - a known non-entry record (`kind` present — notes today, anything a
 *   future version appends tomorrow). Skipped by entry reads WITHOUT being
 *   counted as damage: an old binary reading a newer journal must stay calm.
 * - torn (invalid JSON from a partial append) or malformed (hand-edit
 *   damage) — skipped and counted, never fatal.
 */
type ParsedLine =
  | { type: "entry"; entry: HistoryEntry }
  | { type: "other"; record: Record<string, unknown> }
  | { type: "torn" };

function parseLine(line: string): ParsedLine {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return { type: "torn" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { type: "torn" };
  }
  const record = parsed as Record<string, unknown>;
  // Any record carrying a kind discriminator is not a reading. Unknown kinds
  // are forward-compatible: skip gracefully, don't flag the journal as torn.
  if (typeof record.kind === "string") return { type: "other", record };
  if (typeof record.date !== "string") return { type: "torn" };
  if (typeof record.cast !== "object" || record.cast === null) return { type: "torn" };
  return { type: "entry", entry: parsed as HistoryEntry };
}

/** Parse a `kind:"note"` record into a ReflectionNote, or null if malformed. */
function parseNoteRecord(record: Record<string, unknown>): ReflectionNote | null {
  if (record.kind !== "note") return null;
  if (typeof record.ref !== "string" || typeof record.text !== "string") return null;
  return {
    kind: "note",
    ref: record.ref,
    date: typeof record.date === "string" ? record.date : "",
    timestamp: typeof record.timestamp === "string" ? record.timestamp : "",
    text: record.text,
  };
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

  async appendNote(note: ReflectionNote): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const line = JSON.stringify(note) + "\n";
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
      const parsed = parseLine(trimmed);
      if (parsed.type === "torn") {
        this.skippedLines++;
        continue;
      }
      // Note/unknown-kind record: not a reading, not damage.
      if (parsed.type === "other") continue;
      const entry = parsed.entry;

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

  async *streamNotes(): AsyncIterable<ReflectionNote> {
    if (!(await this.exists())) return;

    const rl = createInterface({
      input: createReadStream(this.path, { encoding: "utf-8" }),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parsed = parseLine(trimmed);
      if (parsed.type !== "other") continue;
      const note = parseNoteRecord(parsed.record);
      if (note) yield note;
    }
  }

  async latest(): Promise<HistoryEntry | null> {
    this.skippedLines = 0;
    if (!(await this.exists())) return null;

    const content = await readFile(this.path, "utf-8");
    const lines = content.trimEnd().split("\n");

    // Walk backwards to find the last non-empty line that parses — a torn
    // final line (interrupted append) falls through to the previous entry,
    // and trailing note records are passed over silently.
    for (let i = lines.length - 1; i >= 0; i--) {
      const trimmed = lines[i].trim();
      if (!trimmed) continue;
      const parsed = parseLine(trimmed);
      if (parsed.type === "torn") {
        this.skippedLines++;
        continue;
      }
      if (parsed.type === "other") continue;
      return parsed.entry;
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
