import { describe, test, expect, beforeEach } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HistoryEntry, Cast, Line, ReflectionNote } from "@iching/core";
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

    // Self-healing append: a torn final line (no trailing newline) must not
    // glue the NEXT record onto the fragment — that silently loses a real
    // reading, not just the already-damaged bytes.
    test("append after a torn final line starts a fresh line", async () => {
      const { appendFile } = await import("node:fs/promises");
      await store.append(makeEntry("2025-01-01"));
      // Torn append: no trailing newline, truncated mid-object.
      await appendFile(join(dir, "history.jsonl"), '{"date":"2025-01-0', "utf-8");

      await store.append(makeEntry("2025-01-02"));

      const results: HistoryEntry[] = [];
      for await (const entry of store.stream()) {
        results.push(entry);
      }
      // The new entry survives on its own line; only the fragment is damage.
      expect(results.map((e) => e.date)).toEqual(["2025-01-01", "2025-01-02"]);
      expect(store.skippedLines).toBe(1);

      const raw = await readFile(join(dir, "history.jsonl"), "utf-8");
      expect(raw).toContain('{"date":"2025-01-0\n');
      expect(raw.endsWith("\n")).toBe(true);
    });

    test("appendNote after a torn sidecar line starts a fresh line", async () => {
      const { appendFile, mkdir } = await import("node:fs/promises");
      await mkdir(dir, { recursive: true });
      await appendFile(join(dir, "notes.jsonl"), '{"kind":"note","re', "utf-8");

      const note: ReflectionNote = {
        kind: "note",
        ref: "2025-01-01",
        date: "2025-01-20",
        timestamp: "2025-01-20T21:00:00.000Z",
        text: "survives the tear",
      };
      await store.appendNote(note);

      const notes: ReflectionNote[] = [];
      for await (const n of store.streamNotes()) {
        notes.push(n);
      }
      expect(notes.map((n) => n.text)).toEqual(["survives the tear"]);
    });

    // Deep cast validation — a syntactically valid record whose cast lacks
    // what readers dereference (GUA[primary - 1], becoming names, lines,
    // changingPositions) is damage, counted like a torn line. An entry like
    // {"date":"…","cast":{}} used to be yielded and crash `journal list`.
    test("stream skips entries whose cast is missing its required shape", async () => {
      const { writeFile } = await import("node:fs/promises");
      const good = JSON.stringify(makeEntry("2025-01-01"));
      await writeFile(
        join(dir, "history.jsonl"),
        `${good}\n{"date":"2025-01-02","cast":{}}\n`,
        "utf-8",
      );

      const results: HistoryEntry[] = [];
      for await (const entry of store.stream()) {
        results.push(entry);
      }

      expect(results.map((e) => e.date)).toEqual(["2025-01-01"]);
      expect(store.skippedLines).toBe(1);
    });

    test("stream skips casts with out-of-range or malformed fields", async () => {
      const { writeFile } = await import("node:fs/promises");
      const good = makeEntry("2025-01-01");
      const damaged = [
        { ...good, cast: { ...good.cast, primary: 0 } },
        { ...good, cast: { ...good.cast, primary: 65 } },
        { ...good, cast: { ...good.cast, primary: 1.5 } },
        { ...good, cast: { ...good.cast, becoming: 99 } },
        { ...good, cast: { ...good.cast, lines: good.cast.lines.slice(0, 5) } },
        { ...good, cast: { ...good.cast, changingPositions: "none" } },
        { ...good, cast: { ...good.cast, changingPositions: [1, "two"] } },
      ];
      await writeFile(
        join(dir, "history.jsonl"),
        [...damaged.map((e) => JSON.stringify(e)), JSON.stringify(good)].join("\n") + "\n",
        "utf-8",
      );

      const results: HistoryEntry[] = [];
      for await (const entry of store.stream()) {
        results.push(entry);
      }

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(good);
      expect(store.skippedLines).toBe(damaged.length);
    });

    test("latest falls back past a trailing malformed-cast record", async () => {
      const { appendFile } = await import("node:fs/promises");
      await store.append(makeEntry("2025-01-01"));
      await appendFile(
        join(dir, "history.jsonl"),
        '{"date":"2025-01-02","cast":{}}\n',
        "utf-8",
      );

      const last = await store.latest();
      expect(last).not.toBeNull();
      expect(last!.date).toBe("2025-01-01");
      expect(store.skippedLines).toBe(1);
    });

    test("a fully shaped entry with a non-null becoming still streams", async () => {
      const entry = makeEntry("2025-01-01");
      entry.cast.becoming = 8;
      entry.cast.changingPositions = [1];
      await store.append(entry);

      const results: HistoryEntry[] = [];
      for await (const e of store.stream()) {
        results.push(e);
      }
      expect(results).toEqual([entry]);
      expect(store.skippedLines).toBe(0);
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

// Reflection notes — the second record shape, written to the notes.jsonl
// sidecar beside the journal so pre-note binaries never meet them.
// kind:"note" lines must never surface as readings, must not count as
// damage, and must stream back in append order (legacy in-journal notes
// first, then the sidecar).
describe("JsonlJournalStore reflection notes", () => {
  let dir: string;
  let store: JsonlJournalStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "journal-notes-test-"));
    store = new JsonlJournalStore(join(dir, "history.jsonl"));
  });

  function makeNote(ref: string, text: string): ReflectionNote {
    return {
      kind: "note",
      ref,
      date: "2025-01-20",
      timestamp: "2025-01-20T21:00:00.000Z",
      text,
    };
  }

  test("appendNote writes exactly one JSON line + newline to the sidecar", async () => {
    const note = makeNote("2025-01-15", "it resolved itself");
    await store.appendNote(note);

    const raw = await readFile(join(dir, "notes.jsonl"), "utf-8");
    const lines = raw.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe("");
    expect(JSON.parse(lines[0])).toEqual(note);
  });

  // The one-way-door regression: a 0.4.0 binary reads history.jsonl with bare
  // JSON.parse and no kind discrimination — a note record in that file crashes
  // it permanently. Notes must therefore never land in history.jsonl.
  test("appendNote never touches history.jsonl (old binaries stay calm)", async () => {
    const { stat } = await import("node:fs/promises");
    await store.append(makeEntry("2025-01-01"));
    const before = await readFile(join(dir, "history.jsonl"), "utf-8");

    await store.appendNote(makeNote("2025-01-01", "nightly reflection"));

    const after = await readFile(join(dir, "history.jsonl"), "utf-8");
    expect(after).toBe(before);
    // Every history line still parses as a plain reading (no kind records).
    for (const line of after.trim().split("\n")) {
      const record = JSON.parse(line);
      expect(record.kind).toBeUndefined();
    }
    expect((await stat(join(dir, "notes.jsonl"))).size).toBeGreaterThan(0);
  });

  test("streamNotes merges legacy in-journal notes before sidecar notes", async () => {
    const { appendFile } = await import("node:fs/promises");
    // Legacy: a note written into history.jsonl by a pre-sidecar binary.
    const legacy = makeNote("2025-01-01", "legacy note");
    await store.append(makeEntry("2025-01-01"));
    await appendFile(join(dir, "history.jsonl"), JSON.stringify(legacy) + "\n", "utf-8");
    // Current: a note appended through the sidecar path.
    await store.appendNote(makeNote("2025-01-01", "sidecar note"));

    const notes: ReflectionNote[] = [];
    for await (const note of store.streamNotes()) {
      notes.push(note);
    }

    expect(notes.map((n) => n.text)).toEqual(["legacy note", "sidecar note"]);
  });

  test("stream skips note records without counting them as damage", async () => {
    await store.append(makeEntry("2025-01-01"));
    await store.appendNote(makeNote("2025-01-01", "noted"));
    await store.append(makeEntry("2025-01-02"));

    const results: HistoryEntry[] = [];
    for await (const entry of store.stream()) {
      results.push(entry);
    }

    expect(results.map((e) => e.date)).toEqual(["2025-01-01", "2025-01-02"]);
    expect(store.skippedLines).toBe(0);
  });

  test("unknown kinds are skipped gracefully (forward compatibility)", async () => {
    const { appendFile } = await import("node:fs/promises");
    await store.append(makeEntry("2025-01-01"));
    await appendFile(
      join(dir, "history.jsonl"),
      '{"kind":"future-record","payload":42}\n',
      "utf-8",
    );

    const results: HistoryEntry[] = [];
    for await (const entry of store.stream()) {
      results.push(entry);
    }

    expect(results.map((e) => e.date)).toEqual(["2025-01-01"]);
    expect(store.skippedLines).toBe(0);
  });

  test("latest passes over trailing note records to the last reading", async () => {
    await store.append(makeEntry("2025-01-01"));
    await store.append(makeEntry("2025-01-02"));
    await store.appendNote(makeNote("2025-01-02", "written at night"));
    await store.appendNote(makeNote("2025-01-01", "second thought"));

    const last = await store.latest();
    expect(last).not.toBeNull();
    expect(last!.date).toBe("2025-01-02");
    expect(store.skippedLines).toBe(0);
  });

  test("streamNotes yields notes in append order, skipping readings and damage", async () => {
    const { appendFile } = await import("node:fs/promises");
    await store.append(makeEntry("2025-01-01"));
    await store.appendNote(makeNote("2025-01-01", "first"));
    await appendFile(join(dir, "history.jsonl"), '{"date":"2025-01-0', "utf-8");
    await appendFile(join(dir, "history.jsonl"), "\n", "utf-8");
    await store.appendNote(makeNote("2025-01-01", "second"));

    const notes: ReflectionNote[] = [];
    for await (const note of store.streamNotes()) {
      notes.push(note);
    }

    expect(notes.map((n) => n.text)).toEqual(["first", "second"]);
  });

  test("streamNotes drops malformed note records (missing ref/text)", async () => {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(
      join(dir, "history.jsonl"),
      '{"kind":"note","ref":"2025-01-01"}\n{"kind":"note","text":"no ref"}\n',
      "utf-8",
    );
    await store.appendNote(makeNote("2025-01-01", "kept"));

    const notes: ReflectionNote[] = [];
    for await (const note of store.streamNotes()) {
      notes.push(note);
    }

    expect(notes.map((n) => n.text)).toEqual(["kept"]);
  });

  test("streamNotes on a missing file yields nothing", async () => {
    const missing = new JsonlJournalStore(join(dir, "nonexistent.jsonl"));
    const notes: ReflectionNote[] = [];
    for await (const note of missing.streamNotes()) {
      notes.push(note);
    }
    expect(notes).toHaveLength(0);
  });
});
