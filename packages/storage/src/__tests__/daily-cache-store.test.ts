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

    // Shape validation: valid JSON that is missing the keys readers
    // dereference (cast.lines / cast.primary) must be treated exactly like
    // corrupt bytes — null + sidecar — never returned for today/hook to
    // crash on.
    test("read returns null + sidecar for valid JSON missing cast", async () => {
      const { writeFile, readFile } = await import("node:fs/promises");
      const path = join(dir, "daily-cache.json");
      const damaged = '{"date":"2025-01-15","shown":true}';
      await writeFile(path, damaged, "utf-8");

      expect(await store.read()).toBeNull();

      const backup = await readFile(`${path}.corrupt`, "utf-8");
      expect(backup).toBe(damaged);
    });

    test("read returns null for a cast missing lines/primary", async () => {
      const { writeFile } = await import("node:fs/promises");
      const path = join(dir, "daily-cache.json");
      await writeFile(
        path,
        '{"date":"2025-01-15","cast":{"becoming":null},"shown":true}',
        "utf-8",
      );
      expect(await store.read()).toBeNull();
    });

    test("read returns null when date is not a string", async () => {
      const { writeFile } = await import("node:fs/promises");
      const record = makeCache("2025-01-15") as unknown as Record<string, unknown>;
      record.date = 20250115;
      await writeFile(join(dir, "daily-cache.json"), JSON.stringify(record), "utf-8");
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

  // Deep shape validation — every field readers dereference unguarded must
  // hold, or the record is quarantined like torn bytes. A partial-but-valid
  // JSON cache (e.g. missing structure) used to pass the guard and crash
  // `iching today` on cache.structure.upper.
  describe("deep shape validation", () => {
    /** Write makeCache with one field damaged, return what read() yields. */
    async function readDamaged(
      mutate: (record: Record<string, unknown>) => void,
    ): Promise<unknown> {
      const { writeFile } = await import("node:fs/promises");
      const record = JSON.parse(
        JSON.stringify(makeCache("2025-01-15")),
      ) as Record<string, unknown>;
      mutate(record);
      await writeFile(join(dir, "daily-cache.json"), JSON.stringify(record), "utf-8");
      return store.read();
    }

    test("missing structure is quarantined (the `iching today` crash)", async () => {
      const { readFile } = await import("node:fs/promises");
      expect(await readDamaged((r) => delete r.structure)).toBeNull();
      // Same quarantine path as unparseable bytes: .corrupt sidecar saved.
      const backup = await readFile(join(dir, "daily-cache.json.corrupt"), "utf-8");
      expect(JSON.parse(backup).structure).toBeUndefined();
    });

    test("structure missing upper or lower is quarantined", async () => {
      expect(
        await readDamaged((r) => delete (r.structure as Record<string, unknown>).upper),
      ).toBeNull();
      expect(
        await readDamaged((r) => ((r.structure as Record<string, unknown>).lower = null)),
      ).toBeNull();
    });

    test("missing or non-boolean shown is quarantined", async () => {
      expect(await readDamaged((r) => delete r.shown)).toBeNull();
      expect(await readDamaged((r) => (r.shown = "yes"))).toBeNull();
    });

    test("primary outside 1-64 or non-integer is quarantined", async () => {
      for (const bad of [0, 65, 1.5, "3", null]) {
        expect(
          await readDamaged((r) => ((r.cast as Record<string, unknown>).primary = bad)),
        ).toBeNull();
      }
    });

    test("becoming must be null or 1-64", async () => {
      for (const bad of [0, 99, "8", undefined]) {
        expect(
          await readDamaged((r) => ((r.cast as Record<string, unknown>).becoming = bad)),
        ).toBeNull();
      }
    });

    test("lines must be six line objects", async () => {
      // Wrong length
      expect(
        await readDamaged((r) => {
          const cast = r.cast as Record<string, unknown>;
          cast.lines = (cast.lines as unknown[]).slice(0, 5);
        }),
      ).toBeNull();
      // Right length, wrong element shape (today walks l.value/isYang/isChanging)
      expect(
        await readDamaged((r) => {
          const cast = r.cast as Record<string, unknown>;
          (cast.lines as unknown[])[2] = 7;
        }),
      ).toBeNull();
      expect(
        await readDamaged((r) => {
          const cast = r.cast as Record<string, unknown>;
          (cast.lines as unknown[])[0] = { value: 7, isYang: "yes", isChanging: false };
        }),
      ).toBeNull();
    });

    test("changingPositions must be an array of integers", async () => {
      expect(
        await readDamaged((r) => ((r.cast as Record<string, unknown>).changingPositions = "1,2")),
      ).toBeNull();
      expect(
        await readDamaged(
          (r) => ((r.cast as Record<string, unknown>).changingPositions = [1, "two"]),
        ),
      ).toBeNull();
    });

    test("derived numbers must be 1-64 (the hook's display cascade indexes GUA)", async () => {
      for (const field of ["nuclear", "polarity", "mirror", "diagonal"]) {
        expect(
          await readDamaged((r) => delete (r.cast as Record<string, unknown>)[field]),
        ).toBeNull();
        expect(
          await readDamaged((r) => ((r.cast as Record<string, unknown>)[field] = 65)),
        ).toBeNull();
      }
    });

    test("a fully shaped record with a non-null becoming still reads back", async () => {
      const record = makeCache("2025-01-15");
      record.cast.becoming = 8;
      record.cast.changingPositions = [1];
      await store.write(record);
      expect(await store.read()).toEqual(record);
    });
  });
});
