import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { tmpdir } from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { JsonlJournalStore } from "../json/jsonl-journal.js";
import { getHexagramHistory } from "../journal-query.js";
import type { Cast, Line } from "@iching/core";

function makeLine(value: 7 | 8): Line {
  return { value, isYang: value === 7, isChanging: false };
}

function makeCast(primary: number): Cast {
  return {
    lines: [makeLine(7), makeLine(8), makeLine(7), makeLine(8), makeLine(7), makeLine(8)],
    primary,
    becoming: null,
    changingPositions: [],
    nuclear: 1,
    polarity: 2,
    mirror: 1,
    diagonal: 2,
  };
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
});
