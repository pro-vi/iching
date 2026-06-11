// Subprocess tests for the `iching journal` command — hexagram filtering,
// name-enriched JSON output, method provenance notes, and torn-line survival.

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, writeFile, appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Cast, HistoryEntry } from "@iching/core";

const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..", "..");
const MAIN_TS = resolve(REPO_ROOT, "apps/cli/src/main.ts");

interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function runCli(dataDir: string, args: string[]): Promise<RunResult> {
  const proc = Bun.spawn(
    ["bun", MAIN_TS, "--data-dir", dataDir, ...args],
    {
      cwd: REPO_ROOT,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, NO_COLOR: "1" },
    },
  );
  proc.stdin.end();
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { exitCode, stdout, stderr };
}

function makeCast(primary: number, becoming: number | null): Cast {
  const isChanging = becoming !== null;
  return {
    lines: [
      { value: isChanging ? 9 : 7, isYang: true, isChanging },
      { value: 7, isYang: true, isChanging: false },
      { value: 8, isYang: false, isChanging: false },
      { value: 7, isYang: true, isChanging: false },
      { value: 8, isYang: false, isChanging: false },
      { value: 7, isYang: true, isChanging: false },
    ],
    primary,
    becoming,
    changingPositions: isChanging ? [1] : [],
    nuclear: 1,
    polarity: 2,
    mirror: 1,
    diagonal: 2,
  };
}

function makeEntry(
  date: string,
  primary: number,
  becoming: number | null,
  method?: HistoryEntry["method"],
): HistoryEntry {
  return { date, cast: makeCast(primary, becoming), timestamp: `${date}T09:00:00.000Z`, method };
}

async function seedJournal(dataDir: string, entries: HistoryEntry[]): Promise<void> {
  const lines = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
  await writeFile(join(dataDir, "history.jsonl"), lines, "utf-8");
}

describe("journal command", () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "iching-journal-cmd-test-"));
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  test("list --hexagram matches primary OR becoming", async () => {
    await seedJournal(dataDir, [
      makeEntry("2026-01-01", 39, null), // primary match
      makeEntry("2026-01-02", 5, null), // no match
      makeEntry("2026-01-03", 3, 39), // becoming match
    ]);

    const { exitCode, stdout } = await runCli(dataDir, ["journal", "list", "--hexagram", "39"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("2026-01-01");
    expect(stdout).not.toContain("2026-01-02");
    expect(stdout).toContain("2026-01-03");
  }, 20_000);

  test("list --hexagram rejects non-numeric and out-of-range values", async () => {
    await seedJournal(dataDir, [makeEntry("2026-01-01", 1, null)]);
    for (const bad of ["abc", "0", "65", "3.5"]) {
      const { exitCode, stderr } = await runCli(dataDir, ["journal", "list", "--hexagram", bad]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("Invalid --hexagram");
    }
  }, 20_000);

  test("list --json enriches entries with resolved names, raw fields intact", async () => {
    await seedJournal(dataDir, [makeEntry("2026-01-03", 3, 39, "yarrow")]);

    const { exitCode, stdout } = await runCli(dataDir, ["--json", "journal", "list"]);
    expect(exitCode).toBe(0);
    const entries = JSON.parse(stdout);
    expect(entries).toHaveLength(1);
    const entry = entries[0];
    // Raw HistoryEntry fields preserved (backward-compatible)
    expect(entry.date).toBe("2026-01-03");
    expect(entry.cast.primary).toBe(3);
    expect(entry.method).toBe("yarrow");
    // Additive name blocks so scripts don't need the data table
    expect(entry.primary.kw).toBe(3);
    expect(entry.primary.n).toBe("屯");
    expect(typeof entry.primary.p).toBe("string");
    expect(typeof entry.primary.ename).toBe("string");
    expect(typeof entry.primary.u).toBe("string");
    expect(entry.becoming.kw).toBe(39);
    expect(entry.becoming.n).toBe("蹇");
  }, 20_000);

  test("list --json becoming is null for unchanging casts", async () => {
    await seedJournal(dataDir, [makeEntry("2026-01-01", 1, null)]);
    const { stdout } = await runCli(dataDir, ["--json", "journal", "list"]);
    const entries = JSON.parse(stdout);
    expect(entries[0].becoming).toBeNull();
  }, 20_000);

  test("show --json is enriched too", async () => {
    await seedJournal(dataDir, [makeEntry("2026-01-03", 3, 39)]);
    const { exitCode, stdout } = await runCli(dataDir, ["--json", "journal", "show", "latest"]);
    expect(exitCode).toBe(0);
    const entry = JSON.parse(stdout);
    expect(entry.primary.kw).toBe(3);
    expect(entry.becoming.kw).toBe(39);
  }, 20_000);

  test("plain list notes non-coin methods quietly; coin stays unmarked", async () => {
    await seedJournal(dataDir, [
      makeEntry("2026-01-01", 1, null, "coin"),
      makeEntry("2026-01-02", 2, null, "yarrow"),
    ]);

    const { stdout } = await runCli(dataDir, ["journal", "list"]);
    const lines = stdout.trimEnd().split("\n");
    const coinLine = lines.find((l) => l.includes("2026-01-01"))!;
    const yarrowLine = lines.find((l) => l.includes("2026-01-02"))!;
    expect(coinLine).not.toContain("coins");
    expect(yarrowLine).toContain("· yarrow stalks");
  }, 20_000);

  test("plain show carries a Method line when provenance exists", async () => {
    await seedJournal(dataDir, [makeEntry("2026-01-02", 2, null, "yarrow-manual")]);
    const { stdout } = await runCli(dataDir, ["journal", "show", "2026-01-02"]);
    expect(stdout).toContain("Method: yarrow stalks, by hand");
  }, 20_000);

  test("plain show omits the Method line for legacy entries", async () => {
    await seedJournal(dataDir, [makeEntry("2026-01-02", 2, null)]);
    const { stdout } = await runCli(dataDir, ["journal", "show", "2026-01-02"]);
    expect(stdout).not.toContain("Method:");
  }, 20_000);

  // Regression: a torn line used to make `journal list` and `journal show`
  // throw a SyntaxError forever. Readers now skip the damage.
  test("list and show survive a torn trailing line", async () => {
    await seedJournal(dataDir, [makeEntry("2026-01-01", 1, null)]);
    await appendFile(join(dataDir, "history.jsonl"), '{"date":"2026-01-0', "utf-8");

    const list = await runCli(dataDir, ["journal", "list"]);
    expect(list.exitCode).toBe(0);
    expect(list.stdout).toContain("2026-01-01");

    const show = await runCli(dataDir, ["journal", "show", "latest"]);
    expect(show.exitCode).toBe(0);
    expect(show.stdout).toContain("2026-01-01");
  }, 20_000);
});
