import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { tmpdir } from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { JsonlJournalStore } from "../json/jsonl-journal.js";
import { getHexagramHistory, loadEntriesWithNotes, noteMatchesEntry, entryNoteRef } from "../journal-query.js";
import type { Cast, Line, ReflectionNote } from "@iching/core";
import { GUA, assembleCast } from "@iching/core";

// A genuine static cast OF the requested hexagram: build the lines from its
// canonical pattern (GUA[kw-1].l) so assembleCast derives primary === kw and a
// consistent set of derived hexagrams. isCastShaped reconstructs and compares,
// so the lines must actually draw the hexagram the query asks about.
function makeCast(primary: number): Cast {
  const lines: Line[] = GUA[primary - 1].l.map((bit) => ({
    value: bit ? 7 : 8,
    isYang: bit === 1,
    isChanging: false,
  }));
  return assembleCast(lines);
}

describe("getHexagramHistory", () => {
  let tmpDir: string;
  let store: JsonlJournalStore;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "iching-test-"));
    store = new JsonlJournalStore(join(tmpDir, "history.jsonl"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true });
  });

  test("returns zero counts for empty journal", async () => {
    const history = await getHexagramHistory(store, 1);
    expect(history.castCount).toBe(0);
    expect(history.lastCastDate).toBeNull();
    expect(history.dates).toHaveLength(0);
  });

  test("counts casts for specific hexagram", async () => {
    await store.append({ date: "2026-03-28", cast: makeCast(1) });
    await store.append({ date: "2026-03-29", cast: makeCast(2) });
    await store.append({ date: "2026-03-30", cast: makeCast(1) });

    const history = await getHexagramHistory(store, 1);
    expect(history.castCount).toBe(2);
    expect(history.lastCastDate).toBe("2026-03-30");
    expect(history.dates).toEqual(["2026-03-28", "2026-03-30"]);
  });

  test("returns empty for hexagram never cast", async () => {
    await store.append({ date: "2026-03-28", cast: makeCast(1) });

    const history = await getHexagramHistory(store, 42);
    expect(history.castCount).toBe(0);
    expect(history.lastCastDate).toBeNull();
  });

  test("lastCastDate is the max date, not the last appended (out-of-order journal)", async () => {
    // An imported/merged/hand-edited journal need not be chronological. The
    // dictionary detail and the 觀象 pane must agree on "last drawn", and the
    // pane uses a max — so this must too, never the append-tail.
    await store.append({ date: "2026-03-30", cast: makeCast(1) }); // newest, appended first
    await store.append({ date: "2026-03-25", cast: makeCast(1) }); // older, appended last

    const history = await getHexagramHistory(store, 1);
    expect(history.castCount).toBe(2);
    expect(history.lastCastDate).toBe("2026-03-30"); // the max, not "2026-03-25"
  });
});

describe("loadEntriesWithNotes", () => {
  let tmpDir: string;
  let store: JsonlJournalStore;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "iching-notes-query-"));
    store = new JsonlJournalStore(join(tmpDir, "history.jsonl"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true });
  });

  function makeNote(ref: string, text: string): ReflectionNote {
    return {
      kind: "note",
      ref,
      date: "2026-03-30",
      timestamp: "2026-03-30T21:00:00.000Z",
      text,
    };
  }

  test("entries without notes get an empty notes array", async () => {
    await store.append({ date: "2026-03-28", cast: makeCast(1) });

    const entries = await loadEntriesWithNotes(store);
    expect(entries).toHaveLength(1);
    expect(entries[0].notes).toEqual([]);
    expect(entries[0].date).toBe("2026-03-28");
  });

  test("notes attach to their reading by timestamp ref", async () => {
    await store.append({
      date: "2026-03-28",
      cast: makeCast(1),
      timestamp: "2026-03-28T08:00:00.000Z",
    });
    await store.append({
      date: "2026-03-29",
      cast: makeCast(2),
      timestamp: "2026-03-29T08:00:00.000Z",
    });
    await store.appendNote(makeNote("2026-03-28T08:00:00.000Z", "morning cast, evening answer"));

    const entries = await loadEntriesWithNotes(store);
    expect(entries[0].notes.map((n) => n.text)).toEqual(["morning cast, evening answer"]);
    expect(entries[1].notes).toEqual([]);
  });

  test("date refs attach to the last reading of that day", async () => {
    await store.append({
      date: "2026-03-28",
      cast: makeCast(1),
      timestamp: "2026-03-28T08:00:00.000Z",
    });
    // Pre-timestamp entry — its key is its date
    await store.append({ date: "2026-03-28", cast: makeCast(2) });
    await store.appendNote(makeNote("2026-03-28", "attached by date"));

    const entries = await loadEntriesWithNotes(store);
    expect(entries[0].notes).toEqual([]);
    expect(entries[1].notes.map((n) => n.text)).toEqual(["attached by date"]);
  });

  test("a precise content ref attaches to the exact same-day legacy cast, not the day's last", async () => {
    // Two timestamp-less casts on one day. A bare date ref lands on the LAST
    // (see above); the content ref the TUI now writes must re-find the FIRST,
    // so a note on a non-last legacy cast stays on the reading it annotated.
    const first = { date: "2026-03-28", cast: makeCast(1) };
    const second = { date: "2026-03-28", cast: makeCast(2) };
    await store.append(first);
    await store.append(second);
    expect(entryNoteRef(first)).not.toBe(entryNoteRef(second)); // distinct by content
    await store.appendNote(makeNote(entryNoteRef(first), "on the first cast"));

    const entries = await loadEntriesWithNotes(store);
    expect(entries[0].notes.map((n) => n.text)).toEqual(["on the first cast"]); // the FIRST…
    expect(entries[1].notes).toEqual([]); // …not the day's last
  });

  test("multiple notes keep append order; orphans are dropped quietly", async () => {
    await store.append({
      date: "2026-03-28",
      cast: makeCast(1),
      timestamp: "2026-03-28T08:00:00.000Z",
    });
    await store.appendNote(makeNote("2026-03-28T08:00:00.000Z", "first"));
    await store.appendNote(makeNote("no-such-reading", "orphan"));
    await store.appendNote(makeNote("2026-03-28T08:00:00.000Z", "second"));

    const entries = await loadEntriesWithNotes(store);
    expect(entries[0].notes.map((n) => n.text)).toEqual(["first", "second"]);
  });
});

describe("noteMatchesEntry", () => {
  test("matches by timestamp when present, else by date", () => {
    const note: ReflectionNote = {
      kind: "note",
      ref: "2026-03-28T08:00:00.000Z",
      date: "2026-03-28",
      timestamp: "2026-03-28T21:00:00.000Z",
      text: "x",
    };
    expect(
      noteMatchesEntry(note, {
        date: "2026-03-28",
        cast: makeCast(1),
        timestamp: "2026-03-28T08:00:00.000Z",
      }),
    ).toBe(true);
    // Entry without a timestamp keys by its date
    expect(
      noteMatchesEntry({ ...note, ref: "2026-03-28" }, { date: "2026-03-28", cast: makeCast(1) }),
    ).toBe(true);
    // A date ref must NOT match an entry that has its own timestamp key
    expect(
      noteMatchesEntry({ ...note, ref: "2026-03-28" }, {
        date: "2026-03-28",
        cast: makeCast(1),
        timestamp: "2026-03-28T08:00:00.000Z",
      }),
    ).toBe(false);
  });
});
