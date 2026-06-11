import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  castHexagram,
  buildStructure,
  SeededRandomSource,
  GUA,
} from "@iching/core";
import { JsonDailyCacheStore, JsonlJournalStore } from "@iching/storage";
import { castToJson } from "../output/json.js";
import { formatCastPlain } from "../output/plain.js";

let dataDir: string;

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "iching-cast-test-"));
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

describe("cast command", () => {
  test("cast with --seed produces deterministic output", () => {
    const source1 = new SeededRandomSource(42);
    const cast1 = castHexagram(source1);

    const source2 = new SeededRandomSource(42);
    const cast2 = castHexagram(source2);

    expect(cast1.primary).toBe(cast2.primary);
    expect(cast1.becoming).toBe(cast2.becoming);
    expect(cast1.lines).toEqual(cast2.lines);
    expect(cast1.nuclear).toBe(cast2.nuclear);
    expect(cast1.polarity).toBe(cast2.polarity);
    expect(cast1.mirror).toBe(cast2.mirror);
    expect(cast1.diagonal).toBe(cast2.diagonal);
  });

  test("cast with --json outputs valid JSON structure", () => {
    const source = new SeededRandomSource(42);
    const cast = castHexagram(source);
    const primary = GUA[cast.primary - 1];
    const becoming = cast.becoming !== null ? GUA[cast.becoming - 1] : null;

    const json = castToJson(cast, primary, becoming, "test question");

    expect(json.question).toBe("test question");
    expect(json.primary).toBeDefined();
    expect((json.primary as Record<string, unknown>).number).toBe(
      cast.primary,
    );
    expect((json.primary as Record<string, unknown>).name).toBe(primary.n);
    expect((json.primary as Record<string, unknown>).pinyin).toBe(primary.p);
    expect((json.primary as Record<string, unknown>).symbol).toBe(primary.u);
    expect(json.commentary).toBeDefined();
    expect(json.derived).toBeDefined();

    // Verify it roundtrips as JSON string
    const str = JSON.stringify(json);
    const parsed = JSON.parse(str);
    expect(parsed.primary.number).toBe(cast.primary);
  });

  test("cast saves to daily cache", async () => {
    const source = new SeededRandomSource(99);
    const cast = castHexagram(source);
    const structure = buildStructure(cast);
    const today = new Date().toISOString().slice(0, 10);

    const cachePath = join(dataDir, "daily-cache.json");
    const cacheStore = new JsonDailyCacheStore(cachePath);

    await cacheStore.write({ date: today, cast, shown: true, structure });

    const cached = await cacheStore.read();
    expect(cached).not.toBeNull();
    expect(cached!.date).toBe(today);
    expect(cached!.cast.primary).toBe(cast.primary);
  });

  test("cast appends to journal", async () => {
    const source = new SeededRandomSource(99);
    const cast = castHexagram(source);
    const today = new Date().toISOString().slice(0, 10);

    const journalPath = join(dataDir, "history.jsonl");
    const journal = new JsonlJournalStore(journalPath);

    await journal.append({ date: today, cast });

    const latest = await journal.latest();
    expect(latest).not.toBeNull();
    expect(latest!.date).toBe(today);
    expect(latest!.cast.primary).toBe(cast.primary);
  });

  test("plain text output includes hexagram info", () => {
    const source = new SeededRandomSource(42);
    const cast = castHexagram(source);
    const primary = GUA[cast.primary - 1];
    const structure = buildStructure(cast);

    const text = formatCastPlain(cast, primary, structure);

    // Should contain the hexagram symbol, name, and pinyin
    expect(text).toContain(primary.u);
    expect(text).toContain(primary.n);
    expect(text).toContain(primary.p);
    expect(text).toContain("Commentary:");
  });
});

// Regression: Number("abc") is NaN and NaN|0 collapsed the PRNG to a constant
// state — `cast --seed abc` exited 0 with the same plausible-looking cast
// forever. Non-numeric seeds must fail loudly.
describe("cast --seed validation (subprocess)", () => {
  const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..", "..");
  const MAIN_TS = resolve(REPO_ROOT, "apps/cli/src/main.ts");

  async function runCast(seed: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const proc = Bun.spawn(["bun", MAIN_TS, "--seed", seed, "cast"], {
      cwd: REPO_ROOT,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, NO_COLOR: "1" },
    });
    proc.stdin.end();
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const exitCode = await proc.exited;
    return { exitCode, stdout, stderr };
  }

  test("non-numeric seed errors on stderr and exits 1", async () => {
    const { exitCode, stdout, stderr } = await runCast("abc");
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Invalid --seed "abc"');
    expect(stdout).toBe("");
  }, 20_000);

  test("empty seed is rejected (Number('') would silently become 0)", async () => {
    const { exitCode, stderr } = await runCast("");
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Invalid --seed");
  }, 20_000);

  test("numeric seed still works and stays deterministic", async () => {
    const a = await runCast("42");
    const b = await runCast("42");
    expect(a.exitCode).toBe(0);
    expect(a.stdout).toBe(b.stdout);
  }, 20_000);
});
