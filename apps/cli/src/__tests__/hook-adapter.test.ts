import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
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

const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..", "..");
const MAIN_TS = resolve(REPO_ROOT, "apps/cli/src/main.ts");

/**
 * "Today" as the SUBPROCESS will stamp it. The bun test runner forces UTC
 * while a spawned child runs in the system timezone, so the two can disagree
 * on the date — runHook pins the child to TZ=UTC to keep them aligned.
 */
function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Run bare `iching` with piped stdin (hook mode) against an ICHING_HOME dir. */
async function runHook(home: string): Promise<number> {
  const proc = Bun.spawn(["bun", MAIN_TS], {
    cwd: REPO_ROOT,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    // The adapter resolves paths without a --data-dir override; collapse
    // all storage into the temp dir via ICHING_HOME. TZ=UTC: see utcToday.
    env: { ...process.env, NO_COLOR: "1", ICHING_HOME: home, TZ: "UTC" },
  });
  proc.stdin.write("{}");
  proc.stdin.end();
  return proc.exited;
}

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
  // A fresh hook cast must record coin provenance in the journal and cache —
  // including rng provenance (default entropy config → crypto).
  test("hook mode records method 'coin' and crypto rng in journal and cache", async () => {
    const exitCode = await runHook(dataDir);
    expect(exitCode).toBe(0);

    const journalLine = (await readFile(join(dataDir, "history.jsonl"), "utf-8")).trim();
    const entry = JSON.parse(journalLine);
    expect(entry.method).toBe("coin");
    expect(entry.rng).toEqual({ source: "crypto", intentionBound: false });

    const cache = JSON.parse(await readFile(join(dataDir, "daily-cache.json"), "utf-8"));
    expect(cache.method).toBe("coin");
    expect(cache.rng).toEqual({ source: "crypto", intentionBound: false });
  }, 20_000);

  // A fresh hook cast must honor the saved entropy config (cf. commands/cast.ts)
  // instead of always reaching for CryptoRandomSource. The hook carries no
  // intention, so a bound cast records intentionBound:false.
  test("hook mode honors entropy=bound config on a fresh cast", async () => {
    await writeFile(
      join(dataDir, "config.json"),
      JSON.stringify({ entropy: "bound" }),
      "utf-8",
    );

    const exitCode = await runHook(dataDir);
    expect(exitCode).toBe(0);

    const journalLine = (await readFile(join(dataDir, "history.jsonl"), "utf-8")).trim();
    const entry = JSON.parse(journalLine);
    expect(entry.rng).toEqual({ source: "bound", intentionBound: false });

    const cache = JSON.parse(await readFile(join(dataDir, "daily-cache.json"), "utf-8"));
    expect(cache.rng).toEqual({ source: "bound", intentionBound: false });
  }, 20_000);

  // Provenance survival: a hook run AFTER a bound/seeded TUI cast rewrites the
  // cache (shown:true) — it must carry the day's rng provenance through, not
  // strip it.
  test("hook mode preserves cached rng provenance on rewrite", async () => {
    const source = new CryptoRandomSource();
    const cast = castHexagram(source);
    const structure = buildStructure(cast);
    const cacheStore = new JsonDailyCacheStore(join(dataDir, "daily-cache.json"));
    await cacheStore.write({
      date: utcToday(),
      cast,
      shown: true,
      structure,
      intention: "will it hold?",
      method: "yarrow",
      rng: { source: "bound", intentionBound: true },
    });

    const exitCode = await runHook(dataDir);
    expect(exitCode).toBe(0);

    const cache = JSON.parse(await readFile(join(dataDir, "daily-cache.json"), "utf-8"));
    expect(cache.rng).toEqual({ source: "bound", intentionBound: true });
    expect(cache.method).toBe("yarrow");
    expect(cache.intention).toBe("will it hold?");
  }, 20_000);
});
