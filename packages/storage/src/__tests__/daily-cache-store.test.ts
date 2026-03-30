import { describe, test, expect, beforeEach } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DailyCache, Cast, Line, Structure } from "@iching/core";
import { JsonDailyCacheStore } from "../json/json-daily-cache.js";

function makeLine(value: 7 | 8): Line {
  return { value, isYang: value === 7, isChanging: false };
}

function makeCache(date: string): DailyCache {
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
  const structure: Structure = {
    upper: { sym: "☰", n: "Qian", img: "Heaven" },
    lower: { sym: "☷", n: "Kun", img: "Earth" },
    becoming: null,
  };
  return { date, cast, shown: false, structure };
}

describe("JsonDailyCacheStore", () => {
  let dir: string;
  let store: JsonDailyCacheStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "cache-test-"));
    store = new JsonDailyCacheStore(join(dir, "daily-cache.json"));
  });

  test("write then read round-trip", async () => {
    const record = makeCache("2025-01-15");
    await store.write(record);

    const loaded = await store.read();
    expect(loaded).toEqual(record);
  });

  test("read returns null when file missing", async () => {
    const missing = new JsonDailyCacheStore(join(dir, "nonexistent.json"));
    const result = await missing.read();
    expect(result).toBeNull();
  });

  test("write creates parent directories", async () => {
    const deepStore = new JsonDailyCacheStore(
      join(dir, "a", "b", "c", "daily-cache.json"),
    );
    const record = makeCache("2025-01-15");
    await deepStore.write(record);

    const loaded = await deepStore.read();
    expect(loaded).toEqual(record);
  });
});
