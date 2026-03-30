import { appendFile, readFile, mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import type { HistoryEntry } from "@iching/core";
import type { HistoryQuery } from "../types.js";
import type { JournalStore } from "../journal-store.js";

export class JsonlJournalStore implements JournalStore {
  constructor(private readonly path: string) {}

  async append(entry: HistoryEntry): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const line = JSON.stringify(entry) + "\n";
    await appendFile(this.path, line, "utf-8");
  }

  async *stream(query?: HistoryQuery): AsyncIterable<HistoryEntry> {
    if (!(await this.exists())) return;

    const rl = createInterface({
      input: createReadStream(this.path, { encoding: "utf-8" }),
      crlfDelay: Infinity,
    });

    let count = 0;
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const entry: HistoryEntry = JSON.parse(trimmed);

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
    if (!(await this.exists())) return null;

    const content = await readFile(this.path, "utf-8");
    const lines = content.trimEnd().split("\n");

    // Walk backwards to find last non-empty line
    for (let i = lines.length - 1; i >= 0; i--) {
      const trimmed = lines[i].trim();
      if (trimmed) return JSON.parse(trimmed) as HistoryEntry;
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
