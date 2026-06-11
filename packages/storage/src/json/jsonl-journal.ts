import { appendFile, readFile, mkdir, open, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import type { HistoryEntry, ReflectionNote } from "@iching/core";
import type { HistoryQuery } from "../types.js";
import type { JournalStore } from "../journal-store.js";

/**
 * Classify one JSONL line:
 * - a HistoryEntry (lines without a `kind` discriminator — every record
 *   written before reflection notes landed, and every reading since);
 * - a known non-entry record (`kind` present — legacy notes written into
 *   history.jsonl before the notes.jsonl sidecar landed, anything a future
 *   version appends tomorrow). Skipped by entry reads WITHOUT being counted
 *   as damage: an old binary reading a newer journal must stay calm.
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

/** True when `path` exists, is non-empty, and its last byte is not "\n". */
async function endsMidLine(path: string): Promise<boolean> {
  let handle;
  try {
    handle = await open(path, "r");
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw err;
  }
  try {
    const { size } = await handle.stat();
    if (size === 0) return false;
    const tail = Buffer.alloc(1);
    await handle.read(tail, 0, 1, size - 1);
    return tail[0] !== 0x0a; // "\n"
  } finally {
    await handle.close();
  }
}

export class JsonlJournalStore implements JournalStore {
  /**
   * Malformed lines skipped by the most recent stream() or latest() call.
   * Reset at the start of each read; callers may surface it as a quiet note
   * (the readings themselves remain intact on the surrounding lines).
   */
  skippedLines = 0;

  /**
   * Reflection notes live in a sidecar file beside the journal (notes.jsonl
   * next to history.jsonl) so a pre-note binary streaming history.jsonl never
   * meets a record shape it cannot parse. Defaults to the journal's own
   * directory; callers with a ResolvedPaths may pass paths.notes explicitly.
   */
  private readonly notesPath: string;

  constructor(private readonly path: string, notesPath?: string) {
    this.notesPath = notesPath ?? join(dirname(path), "notes.jsonl");
  }

  async append(entry: HistoryEntry): Promise<void> {
    await this.appendLine(this.path, JSON.stringify(entry));
  }

  async appendNote(note: ReflectionNote): Promise<void> {
    await this.appendLine(this.notesPath, JSON.stringify(note));
  }

  /**
   * Append one record as its own JSONL line, self-healing a torn final line:
   * if the file's last byte is not "\n" (a previous append was interrupted
   * mid-record), lead with a newline so the new record starts a fresh line
   * instead of gluing onto the fragment and being silently lost with it.
   */
  private async appendLine(path: string, json: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const heal = (await endsMidLine(path)) ? "\n" : "";
    await appendFile(path, heal + json + "\n", "utf-8");
  }

  async *stream(query?: HistoryQuery): AsyncIterable<HistoryEntry> {
    this.skippedLines = 0;
    if (!(await this.exists(this.path))) return;

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
    // Legacy first: notes written into history.jsonl before the sidecar
    // landed predate everything in notes.jsonl, so yielding the journal's
    // own kind:"note" lines before the sidecar preserves append order.
    yield* this.notesIn(this.path);
    yield* this.notesIn(this.notesPath);
  }

  private async *notesIn(path: string): AsyncIterable<ReflectionNote> {
    if (!(await this.exists(path))) return;

    const rl = createInterface({
      input: createReadStream(path, { encoding: "utf-8" }),
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
    if (!(await this.exists(this.path))) return null;

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

  private async exists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }
}
