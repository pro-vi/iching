import { describe, test, expect, beforeEach } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HistoryEntry, Cast, Line } from "@iching/core";
import { JsonlJournalStore } from "../json/jsonl-journal.js";

function makeLine(value: 7 | 8): Line {
  return { value, isYang: value === 7, isChanging: false };
}

function makeEntry(date: string): HistoryEntry {
  const cast: Cast = {
    lines: [
      makeLine(7),
      makeLine(8),
      makeLine(7),
      makeLine(8),
      makeLine(7),
      makeLine(8),
    ],
    primary: 1,
    becoming: null,
    changingPositions: [],
    nuclear: 2,
    polarity: 3,
    mirror: 4,
    diagonal: 5,
  };
  return { date, cast };
}

describe("JsonlJournalStore", () => {
  let dir: string;
  let store: JsonlJournalStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "journal-test-"));
    store = new JsonlJournalStore(join(dir, "history.jsonl"));
  });

  test("append writes exactly one JSON line + newline", async () => {
    const entry = makeEntry("2025-01-15");
    await store.append(entry);

    const raw = await readFile(join(dir, "history.jsonl"), "utf-8");
    const lines = raw.split("\n");
    // One JSON line + trailing empty string from final \n
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe("");
    expect(JSON.parse(lines[0])).toEqual(entry);
  });

  test("stream yields all entries", async () => {
    const e1 = makeEntry("2025-01-01");
    const e2 = makeEntry("2025-01-02");
    const e3 = makeEntry("2025-01-03");

    await store.append(e1);
    await store.append(e2);
    await store.append(e3);

    const results: HistoryEntry[] = [];
    for await (const entry of store.stream()) {
      results.push(entry);
    }

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual(e1);
    expect(results[1]).toEqual(e2);
    expect(results[2]).toEqual(e3);
  });

  test("stream with since filter", async () => {
    await store.append(makeEntry("2025-01-01"));
    await store.append(makeEntry("2025-01-05"));
    await store.append(makeEntry("2025-01-10"));

    const results: HistoryEntry[] = [];
    for await (const entry of store.stream({ since: "2025-01-05" })) {
      results.push(entry);
    }

    expect(results).toHaveLength(2);
    expect(results[0].date).toBe("2025-01-05");
    expect(results[1].date).toBe("2025-01-10");
  });

  test("stream with limit", async () => {
    await store.append(makeEntry("2025-01-01"));
    await store.append(makeEntry("2025-01-02"));
    await store.append(makeEntry("2025-01-03"));

    const results: HistoryEntry[] = [];
    for await (const entry of store.stream({ limit: 2 })) {
      results.push(entry);
    }

    expect(results).toHaveLength(2);
    expect(results[0].date).toBe("2025-01-01");
    expect(results[1].date).toBe("2025-01-02");
  });

  test("latest returns most recent entry", async () => {
    await store.append(makeEntry("2025-01-01"));
    await store.append(makeEntry("2025-01-02"));
    await store.append(makeEntry("2025-01-03"));

    const last = await store.latest();
    expect(last).not.toBeNull();
    expect(last!.date).toBe("2025-01-03");
  });

  test("latest returns null for missing file", async () => {
    const missing = new JsonlJournalStore(join(dir, "nonexistent.jsonl"));
    const result = await missing.latest();
    expect(result).toBeNull();
  });

  test("latest returns null for empty file", async () => {
    const { writeFile } = await import("node:fs/promises");
    const emptyPath = join(dir, "empty.jsonl");
    await writeFile(emptyPath, "", "utf-8");

    const emptyStore = new JsonlJournalStore(emptyPath);
    const result = await emptyStore.latest();
    expect(result).toBeNull();
  });
});
