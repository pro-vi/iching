import { describe, test, expect, beforeEach } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HistoryEntry, Cast, Line, ReflectionNote } from "@iching/core";
import { assembleCast } from "@iching/core";
import { JsonlJournalStore } from "../json/jsonl-journal.js";

function makeLine(value: 7 | 8): Line {
  return { value, isYang: value === 7, isChanging: false };
}

// A genuine cast — assembleCast derives primary/becoming/the four hexagrams
// FROM the lines, so the fixture is internally consistent. isCastShaped now
// reconstructs and compares, so a hand-coded primary/derived that disagreed
// with the lines (the old fixture said primary 1 over alternating lines) would
// read back as torn. These lines form hexagram 63 (既濟), all young.
function baseLines(): Line[] {
  return [makeLine(7), makeLine(8), makeLine(7), makeLine(8), makeLine(7), makeLine(8)];
}

function makeEntry(date: string): HistoryEntry {
  return { date, cast: assembleCast(baseLines()) };
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

  test("stream with until filter (inclusive upper bound)", async () => {
    await store.append(makeEntry("2025-01-01"));
    await store.append(makeEntry("2025-01-05"));
    await store.append(makeEntry("2025-01-10"));

    const results: HistoryEntry[] = [];
    for await (const entry of store.stream({ until: "2025-01-05" })) {
      results.push(entry);
    }

    expect(results.map((e) => e.date)).toEqual(["2025-01-01", "2025-01-05"]);
  });

  test("stream with since + until window (both inclusive)", async () => {
    for (const d of ["2025-01-01", "2025-01-05", "2025-01-10", "2025-01-20"]) {
      await store.append(makeEntry(d));
    }

    const results: HistoryEntry[] = [];
    for await (const entry of store.stream({ since: "2025-01-05", until: "2025-01-10" })) {
      results.push(entry);
    }

    expect(results.map((e) => e.date)).toEqual(["2025-01-05", "2025-01-10"]);
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

    test("a record with malformed changingPositions is torn, not admitted", async () => {
      const { writeFile } = await import("node:fs/promises");
      // changingPositions is held to its own range discipline (0–6 unique, 1–6):
      // out-of-range, duplicate, or >6-length records are corrupt, like a torn
      // line — they must not reach a reader assuming valid positions.
      const withPositions = (positions: number[]): string => {
        // Build consistent lines first (so primary/becoming/derived match), then
        // override ONLY changingPositions — so the range discipline alone judges
        // these records. In-range positions are applied to the lines so the
        // valid [2,5] record stays fully consistent and survives; out-of-range
        // positions can't be applied, so they still fail the range check.
        const lines = baseLines();
        for (const p of positions) {
          if (p >= 1 && p <= 6) lines[p - 1] = { value: 9, isYang: true, isChanging: true };
        }
        const cast = assembleCast(lines);
        cast.changingPositions = positions;
        return JSON.stringify({ date: "2025-01-02", cast });
      };
      const good = JSON.stringify(makeEntry("2025-01-01"));
      await writeFile(
        join(dir, "history.jsonl"),
        [
          good,
          withPositions([0, 3, 99]), // out of range
          withPositions([1, 1, 2]), // duplicate
          withPositions([1, 2, 3, 4, 5, 6, 1]), // length > 6
          withPositions([2, 5]), // valid — survives
        ].join("\n") + "\n",
        "utf-8",
      );

      const results: HistoryEntry[] = [];
      for await (const entry of store.stream()) results.push(entry);
      expect(results.map((e) => e.date)).toEqual(["2025-01-01", "2025-01-02"]);
      expect(results[1].cast.changingPositions).toEqual([2, 5]); // the valid one
      expect(store.skippedLines).toBe(3); // the three malformed records
    });

    test("latest returns null when every line is torn", async () => {
      const { writeFile } = await import("node:fs/promises");
      const path = join(dir, "history.jsonl");
      await writeFile(path, '{"date":"2025-\n{"broken\n', "utf-8");

      const last = await store.latest();
      expect(last).toBeNull();
      expect(store.skippedLines).toBe(2);
    });

    test("a non-string timestamp normalizes to absent, never yielded raw", async () => {
      // entryTimeKey(e).localeCompare(...) throws on a non-string timestamp,
      // which took down `journal list`'s sort. A corrupt / hand-edited object
      // timestamp must read back as absent (the entry falls back to its date),
      // not as the raw object. (External review, H3.)
      const { writeFile } = await import("node:fs/promises");
      const path = join(dir, "history.jsonl");
      const corrupt = { ...makeEntry("2026-04-01"), timestamp: { bad: true } } as unknown as HistoryEntry;
      await writeFile(path, JSON.stringify(corrupt) + "\n", "utf-8");

      const entries: HistoryEntry[] = [];
      for await (const entry of store.stream()) entries.push(entry);
      expect(entries).toHaveLength(1);
      expect(entries[0].timestamp).toBeUndefined(); // normalized; entryTimeKey falls back to date
    });

    test("a semantically-false cast is torn — value disagreeing with isYang, or changingPositions with the lines", async () => {
      // isCastShaped exists to reject records that "quietly mislead a reader" —
      // not just crash one. A shape-valid but INTERNALLY-FALSE cast renders a
      // reading that looks valid but lies, worse than a loud failure. (Review.)
      const { writeFile } = await import("node:fs/promises");
      const good = JSON.stringify(makeEntry("2025-01-01"));
      // value 7 = young yang, but isYang:false says yin — the diagram would draw
      // yin while the label says 7.
      const badLine = makeEntry("2025-01-02");
      badLine.cast.lines[0] = { value: 7, isYang: false, isChanging: false };
      // changingPositions claims line 1 moves, but no line is changing — the
      // reading-method rule and the line diagram would disagree.
      const badPositions = makeEntry("2025-01-03");
      badPositions.cast.changingPositions = [1];
      await writeFile(
        join(dir, "history.jsonl"),
        [good, JSON.stringify(badLine), JSON.stringify(badPositions)].join("\n") + "\n",
        "utf-8",
      );

      const results: HistoryEntry[] = [];
      for await (const e of store.stream()) results.push(e);
      expect(results.map((e) => e.date)).toEqual(["2025-01-01"]); // only the consistent cast
      expect(store.skippedLines).toBe(2); // both semantically-false casts skipped like torn bytes
    });

    test("a cast whose primary/becoming/derived disagree with its lines is torn", async () => {
      // The lines ARE the cast — primary, becoming, and the four derived
      // hexagrams are all DERIVED from them. A record can be shape-valid and
      // internally line-consistent yet carry a primary (or derived) that names a
      // DIFFERENT hexagram than the lines draw: a hand-edited/imported row that
      // would show hexagram X's oracle texts over hexagram Y's diagram — a
      // plausible but false reading. isCastShaped reconstructs and compares.
      const { writeFile } = await import("node:fs/promises");
      const good = JSON.stringify(makeEntry("2025-01-01")); // lines form 63, primary 63
      // Same lines, but primary mislabeled 1 — the reading would speak 乾 over a
      // 既濟 diagram.
      const badPrimary = makeEntry("2025-01-02");
      badPrimary.cast.primary = 1;
      // Same lines, but a derived hexagram (nuclear) mislabeled.
      const badNuclear = makeEntry("2025-01-03");
      badNuclear.cast.nuclear = badNuclear.cast.nuclear === 1 ? 2 : 1;
      await writeFile(
        join(dir, "history.jsonl"),
        [good, JSON.stringify(badPrimary), JSON.stringify(badNuclear)].join("\n") + "\n",
        "utf-8",
      );

      const results: HistoryEntry[] = [];
      for await (const e of store.stream()) results.push(e);
      expect(results.map((e) => e.date)).toEqual(["2025-01-01"]); // only the true cast
      expect(store.skippedLines).toBe(2); // both mislabeled casts torn
    });

    test("latest and stream agree on lone-CR (old-Mac) line endings", async () => {
      // stream() reads via readline, which breaks on \n, \r\n AND a lone \r;
      // latest() split on "\n" only, so an externally lone-CR-delimited journal
      // (a hand-edit or import carrying old-Mac endings) collapsed into one
      // giant unparseable line and latest() returned null — `iching today` saw
      // an empty journal that `journal list` streamed in full. The two readers
      // must resolve the SAME last entry whatever the newline style.
      const { writeFile } = await import("node:fs/promises");
      const path = join(dir, "history.jsonl");
      const e1 = makeEntry("2025-02-01");
      const e2 = makeEntry("2025-02-02");
      await writeFile(path, `${JSON.stringify(e1)}\r${JSON.stringify(e2)}\r`, "utf-8");

      const streamed: HistoryEntry[] = [];
      for await (const e of store.stream()) streamed.push(e);
      const last = await store.latest();

      expect(streamed.map((e) => e.date)).toEqual(["2025-02-01", "2025-02-02"]);
      expect(last?.date).toBe("2025-02-02"); // recovered, not null…
      expect(last?.date).toBe(streamed[streamed.length - 1].date); // …and stream agrees
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
      // Line 1 moves — assembleCast derives the real becoming and changingPositions,
      // so the whole cast is internally consistent (non-null becoming included).
      const lines = baseLines();
      lines[0] = { value: 9, isYang: true, isChanging: true };
      const entry: HistoryEntry = { date: "2025-01-01", cast: assembleCast(lines) };
      expect(entry.cast.becoming).not.toBeNull();
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

  test("an unreadable notes sidecar yields nothing and never takes the readings down", async () => {
    const { mkdir } = await import("node:fs/promises");
    // A reading exists; its notes sidecar is a directory (→ EISDIR when read;
    // in the wild a root-owned notes.jsonl → EACCES). Reflection notes are
    // supplementary, so a sidecar read failure must not throw — it would crash
    // `journal show` or, in the TUI, empty a journal whose readings are fine.
    await store.append(makeEntry("2026-04-01"));
    await mkdir(join(dir, "notes.jsonl")); // unreadable sidecar

    const notes: ReflectionNote[] = [];
    for await (const note of store.streamNotes()) notes.push(note); // never throws
    expect(notes).toHaveLength(0);

    // …and the readings stay fully accessible.
    const entries: HistoryEntry[] = [];
    for await (const e of store.stream()) entries.push(e);
    expect(entries.map((e) => e.date)).toEqual(["2026-04-01"]);
  });
});
