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

  // Torn-line tolerance: a crash / power loss / ENOSPC mid-append leaves a
  // partial JSON line. One bad line must never make the whole journal
  // unreadable — readers skip it and surface a count.
  describe("torn/malformed lines", () => {
    test("stream skips a torn trailing line and keeps prior entries", async () => {
      const { appendFile } = await import("node:fs/promises");
      await store.append(makeEntry("2025-01-01"));
      await store.append(makeEntry("2025-01-02"));
      // Torn append: no newline, truncated mid-object
      await appendFile(join(dir, "history.jsonl"), '{"date":"2025-01-0', "utf-8");

      const results: HistoryEntry[] = [];
      for await (const entry of store.stream()) {
        results.push(entry);
      }

      expect(results.map((e) => e.date)).toEqual(["2025-01-01", "2025-01-02"]);
      expect(store.skippedLines).toBe(1);
    });

    test("stream skips a torn middle line and keeps reading past it", async () => {
      const { writeFile } = await import("node:fs/promises");
      const good1 = JSON.stringify(makeEntry("2025-01-01"));
      const good2 = JSON.stringify(makeEntry("2025-01-03"));
      await writeFile(
        join(dir, "history.jsonl"),
        `${good1}\n{"date":"2025-01-02","cas\n${good2}\n`,
        "utf-8",
      );

      const results: HistoryEntry[] = [];
      for await (const entry of store.stream()) {
        results.push(entry);
      }

      expect(results.map((e) => e.date)).toEqual(["2025-01-01", "2025-01-03"]);
      expect(store.skippedLines).toBe(1);
    });

    test("stream skips valid JSON that is not entry-shaped", async () => {
      const { writeFile } = await import("node:fs/promises");
      const good = JSON.stringify(makeEntry("2025-01-01"));
      // Scalars, arrays, and objects missing date/cast are all damage, not entries
      await writeFile(
        join(dir, "history.jsonl"),
        `42\nnull\n[1,2]\n{"date":"2025-01-02"}\n${good}\n`,
        "utf-8",
      );

      const results: HistoryEntry[] = [];
      for await (const entry of store.stream()) {
        results.push(entry);
      }

      expect(results.map((e) => e.date)).toEqual(["2025-01-01"]);
      expect(store.skippedLines).toBe(4);
    });

    test("latest falls back past a torn final line to the last good entry", async () => {
      const { appendFile } = await import("node:fs/promises");
      await store.append(makeEntry("2025-01-01"));
      await store.append(makeEntry("2025-01-02"));
      await appendFile(join(dir, "history.jsonl"), '{"date":"2025-01-0', "utf-8");

      const last = await store.latest();
      expect(last).not.toBeNull();
      expect(last!.date).toBe("2025-01-02");
      expect(store.skippedLines).toBe(1);
    });

    test("latest returns null when every line is torn", async () => {
      const { writeFile } = await import("node:fs/promises");
      const path = join(dir, "history.jsonl");
      await writeFile(path, '{"date":"2025-\n{"broken\n', "utf-8");

      const last = await store.latest();
      expect(last).toBeNull();
      expect(store.skippedLines).toBe(2);
    });

    test("skippedLines resets between reads", async () => {
      const { appendFile } = await import("node:fs/promises");
      await store.append(makeEntry("2025-01-01"));
      await appendFile(join(dir, "history.jsonl"), "garbage", "utf-8");

      await store.latest();
      expect(store.skippedLines).toBe(1);

      // A clean read must not inherit the previous count
      const clean = new JsonlJournalStore(join(dir, "clean.jsonl"));
      await clean.append(makeEntry("2025-02-01"));
      for await (const _ of clean.stream()) {
        // drain
      }
      expect(clean.skippedLines).toBe(0);
    });
  });
});
