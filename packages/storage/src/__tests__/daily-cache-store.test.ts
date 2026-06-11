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

  // Corrupt-cache tolerance: a torn write or disk fault must not crash
  // interactive startup forever — read() treats the file as absent and
  // sidecars the bytes (cf. JsonConfigStore's corrupt handling).
  describe("corrupt cache file", () => {
    test("read returns null on unparseable JSON and sidecars the bytes", async () => {
      const { writeFile, readFile } = await import("node:fs/promises");
      const path = join(dir, "daily-cache.json");
      await writeFile(path, '{"date":"2025-01-15","cas', "utf-8"); // torn write

      const result = await store.read();
      expect(result).toBeNull();

      const backup = await readFile(`${path}.corrupt`, "utf-8");
      expect(backup).toBe('{"date":"2025-01-15","cas');
    });

    test("a later corruption never clobbers the first backup", async () => {
      const { writeFile, readFile } = await import("node:fs/promises");
      const path = join(dir, "daily-cache.json");
      await writeFile(path, "first-garbage", "utf-8");
      expect(await store.read()).toBeNull();

      await writeFile(path, "second-garbage", "utf-8");
      expect(await store.read()).toBeNull();

      // wx flag: the FIRST backup is the recoverable one
      const backup = await readFile(`${path}.corrupt`, "utf-8");
      expect(backup).toBe("first-garbage");
    });

    test("read returns null for valid JSON that is not a record", async () => {
      const { writeFile } = await import("node:fs/promises");
      const path = join(dir, "daily-cache.json");
      await writeFile(path, "42", "utf-8");
      expect(await store.read()).toBeNull();
    });

    test("a fresh write after corruption recovers normal round-trips", async () => {
      const { writeFile } = await import("node:fs/promises");
      const path = join(dir, "daily-cache.json");
      await writeFile(path, "garbage", "utf-8");
      expect(await store.read()).toBeNull();

      const record = makeCache("2025-01-16");
      await store.write(record);
      expect(await store.read()).toEqual(record);
    });
  });
});
