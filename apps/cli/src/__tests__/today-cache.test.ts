// resolveTodayReading — the shared "today's reading" resolver behind the home
// [t] reopen, `iching today`, and (conceptually) the hook. It re-reads the clock
// and stores at call time (the home loop blocks across midnight; deciding from
// pre-block snapshots replayed yesterday's reading as today's), and honors the
// durable-recovery invariant: the daily cache is a fast mirror, so when it is
// missing/stale/quarantined the journal — the durable record — is consulted.

import { describe, test, expect } from "bun:test";
import { buildStructure } from "@iching/core";
import type { DailyCache, HistoryEntry } from "@iching/core";
import type { DailyCacheStore, JournalStore } from "@iching/storage";
import { castOf } from "@iching/core/testing";
import { resolveTodayReading } from "../util/today-cache.ts";

function makeCache(date: string, intention?: string): DailyCache {
  // Hexagram 63 (既濟), all young; castOf derives a consistent
  // primary/becoming/derived so the cache passes isCastShaped on read.
  const cast = castOf(63);
  return { date, cast, shown: true, structure: buildStructure(cast), intention };
}

/** In-memory cache store — read() always reflects the current record. */
function memoryStore(initial: DailyCache | null): DailyCacheStore & { record: DailyCache | null } {
  return {
    record: initial,
    async read() {
      return this.record;
    },
    async write(record: DailyCache) {
      this.record = record;
    },
  };
}

function makeEntry(date: string, intention?: string): HistoryEntry {
  return { date, cast: castOf(63), timestamp: `${date}T08:00:00.000Z`, intention, method: "coin" };
}

/** Journal stub whose latest() returns the given entry (the only method used). */
function journalWith(latestEntry: HistoryEntry | null): JournalStore {
  return {
    skippedLines: 0,
    async append() {},
    async appendNote() {},
    async *stream() {},
    async *streamNotes() {},
    async latest() {
      return latestEntry;
    },
  };
}

const noJournal = () => journalWith(null);

describe("resolveTodayReading — cache resolution", () => {
  test("returns the cached record when its date is (the current) today", async () => {
    const store = memoryStore(makeCache("2026-06-10", "morning question"));
    const result = await resolveTodayReading(store, noJournal(), () => "2026-06-10");
    expect(result?.date).toBe("2026-06-10");
    expect(result?.intention).toBe("morning question");
  });

  test("returns null for a stale cache (yesterday's reading) with no journal recovery", async () => {
    const store = memoryStore(makeCache("2026-06-09"));
    expect(await resolveTodayReading(store, noJournal(), () => "2026-06-10")).toBeNull();
  });

  test("returns null when neither cache nor journal exists", async () => {
    expect(await resolveTodayReading(memoryStore(null), noJournal(), () => "2026-06-10")).toBeNull();
  });

  test("re-reads the clock at call time — a midnight rollover invalidates the replay", async () => {
    const store = memoryStore(makeCache("2026-06-09"));
    let now = "2026-06-09";
    const today = () => now;

    // Before midnight the cached reading is replayable…
    expect((await resolveTodayReading(store, noJournal(), today))?.date).toBe("2026-06-09");

    // …after midnight the same call says no (the old code compared two
    // pre-midnight snapshots and replayed yesterday's reading as today's).
    now = "2026-06-10";
    expect(await resolveTodayReading(store, noJournal(), today)).toBeNull();
  });

  test("re-reads the store at call time — a cache written mid-session is picked up", async () => {
    const store = memoryStore(null);
    const today = () => "2026-06-10";
    expect(await resolveTodayReading(store, noJournal(), today)).toBeNull();

    // e.g. the Claude Code hook cast while the home scene sat open
    await store.write(makeCache("2026-06-10", "written elsewhere"));
    expect((await resolveTodayReading(store, noJournal(), today))?.intention).toBe("written elsewhere");
  });
});

describe("resolveTodayReading — durable journal recovery", () => {
  test("recovers today's reading from the journal when the cache is missing", async () => {
    const result = await resolveTodayReading(
      memoryStore(null),
      journalWith(makeEntry("2026-06-10", "in the journal only")),
      () => "2026-06-10",
    );
    expect(result?.date).toBe("2026-06-10");
    expect(result?.intention).toBe("in the journal only");
    expect(result?.shown).toBe(true); // reconstructed as shown — it was cast today
    expect(result?.structure).toBeDefined(); // structure rebuilt from the cast
  });

  test("recovers from the journal when the cache is stale (cache loss after a rollover)", async () => {
    const result = await resolveTodayReading(
      memoryStore(makeCache("2026-06-09")), // yesterday's cache lingers…
      journalWith(makeEntry("2026-06-10")), // …but the journal holds today
      () => "2026-06-10",
    );
    expect(result?.date).toBe("2026-06-10");
  });

  test("the cache wins when it holds today — the journal is not consulted", async () => {
    const result = await resolveTodayReading(
      memoryStore(makeCache("2026-06-10", "from cache")),
      journalWith(makeEntry("2026-06-10", "from journal")),
      () => "2026-06-10",
    );
    expect(result?.intention).toBe("from cache");
  });

  test("a journal whose latest is NOT today does not satisfy recovery", async () => {
    const result = await resolveTodayReading(
      memoryStore(null),
      journalWith(makeEntry("2026-06-09")), // yesterday's reading is the latest
      () => "2026-06-10",
    );
    expect(result).toBeNull();
  });

  test("recovery re-warms the cache so the next read hits it (no second journal scan)", async () => {
    const cache = memoryStore(null);
    let latestCalls = 0;
    const journal: JournalStore = {
      ...journalWith(makeEntry("2026-06-10", "from journal")),
      async latest() {
        latestCalls++;
        return makeEntry("2026-06-10", "from journal");
      },
    };
    const r1 = await resolveTodayReading(cache, journal, () => "2026-06-10");
    expect(r1?.date).toBe("2026-06-10");
    expect(cache.record?.date).toBe("2026-06-10"); // cache healed from the journal…
    expect(cache.record?.shown).toBe(true);
    expect(latestCalls).toBe(1);

    // …so the next resolve is served from the now-warm cache, not a fresh scan.
    const r2 = await resolveTodayReading(cache, journal, () => "2026-06-10");
    expect(r2?.intention).toBe("from journal");
    expect(latestCalls).toBe(1); // still 1 — the journal was not consulted again
  });

  test("a journal read failure degrades to null, never throws", async () => {
    const throwing: JournalStore = {
      ...journalWith(null),
      async latest() {
        throw new Error("blocked data dir");
      },
    };
    expect(await resolveTodayReading(memoryStore(null), throwing, () => "2026-06-10")).toBeNull();
  });
});
