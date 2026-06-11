// readTodayCache — the openToday dispatch guard. The home loop blocks on the
// home scene for an unbounded time; deciding whether [t] may replay the cached
// reading from snapshots taken BEFORE that block replayed yesterday's reading
// as today after midnight. The helper re-reads both the clock and the store
// at dispatch time.

import { describe, test, expect } from "bun:test";
import { buildStructure } from "@iching/core";
import type { Cast, DailyCache, Line } from "@iching/core";
import type { DailyCacheStore } from "@iching/storage";
import { readTodayCache } from "../util/today-cache.ts";

function makeLine(value: 6 | 7 | 8 | 9): Line {
  return {
    value,
    isYang: value === 7 || value === 9,
    isChanging: value === 6 || value === 9,
  };
}

function makeCache(date: string, intention?: string): DailyCache {
  const cast: Cast = {
    lines: [makeLine(7), makeLine(8), makeLine(7), makeLine(8), makeLine(7), makeLine(8)],
    primary: 64,
    becoming: null,
    changingPositions: [],
    nuclear: 1,
    polarity: 63,
    mirror: 64,
    diagonal: 63,
  };
  return { date, cast, shown: true, structure: buildStructure(cast), intention };
}

/** In-memory store — read() always reflects the current record. */
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

describe("readTodayCache", () => {
  test("returns the cached record when its date is (the current) today", async () => {
    const store = memoryStore(makeCache("2026-06-10", "morning question"));
    const result = await readTodayCache(store, () => "2026-06-10");
    expect(result?.date).toBe("2026-06-10");
    expect(result?.intention).toBe("morning question");
  });

  test("returns null for a stale cache (yesterday's reading after midnight)", async () => {
    const store = memoryStore(makeCache("2026-06-09"));
    expect(await readTodayCache(store, () => "2026-06-10")).toBeNull();
  });

  test("returns null when no cache exists", async () => {
    expect(await readTodayCache(memoryStore(null), () => "2026-06-10")).toBeNull();
  });

  test("re-reads the clock at call time — a midnight rollover invalidates the replay", async () => {
    const store = memoryStore(makeCache("2026-06-09"));
    let now = "2026-06-09";
    const today = () => now;

    // Before midnight the cached reading is replayable…
    expect((await readTodayCache(store, today))?.date).toBe("2026-06-09");

    // …after midnight the same call says no (the old code compared two
    // pre-midnight snapshots and replayed yesterday's reading as today).
    now = "2026-06-10";
    expect(await readTodayCache(store, today)).toBeNull();
  });

  test("re-reads the store at call time — a cache written mid-session is picked up", async () => {
    const store = memoryStore(null);
    const today = () => "2026-06-10";
    expect(await readTodayCache(store, today)).toBeNull();

    // e.g. the Claude Code hook cast while the home scene sat open
    await store.write(makeCache("2026-06-10", "written elsewhere"));
    expect((await readTodayCache(store, today))?.intention).toBe("written elsewhere");
  });
});
