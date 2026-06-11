import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  castHexagram,
  buildStructure,
  selectDisplay,
  CryptoRandomSource,
} from "@iching/core";
import {
  JsonDailyCacheStore,
  JsonlJournalStore,
} from "@iching/storage";

let dataDir: string;

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "iching-hook-test-"));
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

describe("hook adapter", () => {
  test("simulated hook input produces output and saves state", async () => {
    // Simulate the hook adapter logic directly (without piping to process)
    const source = new CryptoRandomSource();
    const cachePath = join(dataDir, "daily-cache.json");
    const journalPath = join(dataDir, "history.jsonl");

    const cacheStore = new JsonDailyCacheStore(cachePath);
    const journal = new JsonlJournalStore(journalPath);

    const today = new Date().toISOString().slice(0, 10);

    // No cache yet — fresh cast
    const cached = await cacheStore.read();
    expect(cached).toBeNull();

    const cast = castHexagram(source);
    const structure = buildStructure(cast);
    const shown = false;

    const display = selectDisplay(cast, structure, shown, source);

    // First call: shown=false should always produce output
    expect(display).not.toBeNull();
    expect(typeof display).toBe("string");

    // Save cache + journal
    await cacheStore.write({ date: today, cast, shown: true, structure });
    await journal.append({ date: today, cast });

    // Verify cache persisted
    const cachedAfter = await cacheStore.read();
    expect(cachedAfter).not.toBeNull();
    expect(cachedAfter!.date).toBe(today);
    expect(cachedAfter!.shown).toBe(true);

    // Verify journal persisted
    const latest = await journal.latest();
    expect(latest).not.toBeNull();
    expect(latest!.date).toBe(today);
  });

  test("cached reading on same day uses cache", async () => {
    const source = new CryptoRandomSource();
    const cachePath = join(dataDir, "daily-cache.json");
    const cacheStore = new JsonDailyCacheStore(cachePath);

    const today = new Date().toISOString().slice(0, 10);
    const cast = castHexagram(source);
    const structure = buildStructure(cast);

    // Write cache as if already shown
    await cacheStore.write({ date: today, cast, shown: true, structure });

    // Read back
    const cached = await cacheStore.read();
    expect(cached).not.toBeNull();
    expect(cached!.date).toBe(today);
    expect(cached!.shown).toBe(true);
    expect(cached!.cast.primary).toBe(cast.primary);
  });

  // End-to-end: bare `iching` with piped stdin enters hook mode (main.ts).
  // A fresh hook cast must record coin provenance in the journal and cache.
  test("hook mode records method 'coin' in journal and cache", async () => {
    const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..", "..");
    const MAIN_TS = resolve(REPO_ROOT, "apps/cli/src/main.ts");

    const proc = Bun.spawn(["bun", MAIN_TS], {
      cwd: REPO_ROOT,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      // The adapter resolves paths without a --data-dir override; collapse
      // all storage into the temp dir via ICHING_HOME.
      env: { ...process.env, NO_COLOR: "1", ICHING_HOME: dataDir },
    });
    proc.stdin.write("{}");
    proc.stdin.end();
    const exitCode = await proc.exited;
    expect(exitCode).toBe(0);

    const journalLine = (await readFile(join(dataDir, "history.jsonl"), "utf-8")).trim();
    const entry = JSON.parse(journalLine);
    expect(entry.method).toBe("coin");

    const cache = JSON.parse(await readFile(join(dataDir, "daily-cache.json"), "utf-8"));
    expect(cache.method).toBe("coin");
  }, 20_000);
});
