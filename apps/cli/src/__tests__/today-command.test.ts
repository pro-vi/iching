// Subprocess tests for `iching today` — the one-shot daily anchor. Reads the
// daily cache: prints the full reading when today's cast exists, and a calm
// invitation (exit 0 — a state, not an error) when it doesn't. `--json` is the
// LLM/scripting integration surface: castToJson payload + date/intention/method.

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { runCli } from "../testing.ts";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildStructure } from "@iching/core";
import type { DailyCache } from "@iching/core";
import { castOf } from "@iching/core/testing";

/**
 * The subprocess is pinned to TZ=UTC (via the env on each runCli call) so the CLI's localToday() agrees
 * with this UTC formula — bun test itself defaults to UTC, but the machine's
 * shell TZ would otherwise leak into the spawned CLI and skew the date near
 * midnight boundaries.
 */
function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** KW3 屯 with line 1 moving → becoming KW8 比 (water over earth). The lines
 *  draw 屯; assembleCast derives primary 3, becoming 8, and the four hexagrams
 *  consistently, so the record passes isCastShaped's reconstruct-and-compare. */
function makeCast() {
  return castOf(3, { changing: [1] }); // 屯 with line 1 moving → becoming 比 (8)
}

function makeCache(date: string): DailyCache {
  const cast = makeCast();
  return {
    date,
    cast,
    shown: true,
    structure: buildStructure(cast),
    intention: "what needs patience?",
    method: "yarrow",
  };
}

async function seedCache(dataDir: string, cache: DailyCache): Promise<void> {
  await writeFile(
    join(dataDir, "daily-cache.json"),
    JSON.stringify(cache),
    "utf-8",
  );
}

/** A single today reading in history.jsonl — the durable record the cache mirrors. */
function todayEntry(): Record<string, unknown> {
  return {
    date: utcToday(),
    cast: makeCast(), // 屯 with line 1 moving → 比
    timestamp: `${utcToday()}T09:00:00.000Z`,
    method: "yarrow",
    intention: "recovered from history",
  };
}

async function seedJournal(dataDir: string, entries: Record<string, unknown>[]): Promise<void> {
  const lines = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
  await writeFile(join(dataDir, "history.jsonl"), lines, "utf-8");
}

describe("today command", () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "iching-today-cmd-test-"));
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  test("prints the full reading when today's cast exists", async () => {
    await seedCache(dataDir, makeCache(utcToday()));
    const { exitCode, stdout } = await runCli(["today"], { dataDir, env: { TZ: "UTC" } });
    expect(exitCode).toBe(0);
    // Day context
    expect(stdout).toContain(`Date: ${utcToday()}`);
    expect(stdout).toContain("Intention: what needs patience?");
    expect(stdout).toContain("Method: yarrow stalks");
    // Primary + becoming
    expect(stdout).toContain("屯");
    expect(stdout).toContain("Hexagram 3");
    expect(stdout).toContain("Becoming:");
    expect(stdout).toContain("比");
    // Judgment + the 啟蒙 reading the cast turns on. This cast moves exactly one
    // line, so the reading is that line's 爻辭 under the rule-neutral header.
    expect(stdout).toContain("Judgment (gc):");
    expect(stdout).toContain("Reading (啟蒙):");
    expect(stdout).toContain("磐桓"); // KW3 line 1 爻辭
  }, 20_000);

  test("--json emits the castToJson payload plus date/intention/method", async () => {
    await seedCache(dataDir, makeCache(utcToday()));
    const { exitCode, stdout } = await runCli(["--json", "today"], { dataDir, env: { TZ: "UTC" } });
    expect(exitCode).toBe(0);
    const payload = JSON.parse(stdout);
    expect(payload.date).toBe(utcToday());
    expect(payload.intention).toBe("what needs patience?");
    expect(payload.method).toBe("yarrow");
    expect(payload.primary.number).toBe(3);
    expect(payload.primary.name).toBe("屯");
    expect(payload.primary.judgment.gc).toBeTruthy();
    expect(payload.becoming.number).toBe(8);
    expect(payload.changingLines).toHaveLength(1);
    expect(payload.changingLines[0].position).toBe(1);
    expect(typeof payload.changingLines[0].yao).toBe("string");
    expect(typeof payload.changingLines[0].yaoEn).toBe("string");
    expect(payload.commentary.w).toBeTruthy();
  }, 20_000);

  test("no cache yet: calm invitation on stdout, exit 0", async () => {
    const { exitCode, stdout, stderr } = await runCli(["today"], { dataDir, env: { TZ: "UTC" } });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("no reading yet today — run `iching` to cast");
    expect(stderr).toBe("");
  }, 20_000);

  test("stale cache (yesterday) counts as no reading today", async () => {
    await seedCache(dataDir, makeCache("2001-01-01"));
    const { exitCode, stdout } = await runCli(["today"], { dataDir, env: { TZ: "UTC" } });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("no reading yet today");
    expect(stdout).not.toContain("Hexagram 3");
  }, 20_000);

  test("--json with no cast: stable null payload, exit 0", async () => {
    const { exitCode, stdout } = await runCli(["--json", "today"], { dataDir, env: { TZ: "UTC" } });
    expect(exitCode).toBe(0);
    const payload = JSON.parse(stdout);
    expect(payload.date).toBe(utcToday());
    expect(payload.primary).toBeNull();
    expect(payload.becoming).toBeNull();
    expect(payload.intention).toBeNull();
    expect(payload.method).toBeNull();
    // List-shaped keys are empty arrays so scripts can iterate either state.
    expect(payload.changingPositions).toEqual([]);
    expect(payload.changingLines).toEqual([]);
    expect(payload.extra).toBeNull();
    expect(payload.derived).toBeNull();
    expect(payload.commentary).toBeNull();
    expect(payload.rng).toBeNull();
  }, 20_000);

  // Regression: the empty state used to expose only 6 of the 12 keys —
  // consumers branching on key presence broke. Both states must expose the
  // IDENTICAL key set; only the values differ.
  test("--json key set is identical with and without a cast", async () => {
    const empty = await runCli(["--json", "today"], { dataDir, env: { TZ: "UTC" } });
    expect(empty.exitCode).toBe(0);
    const emptyKeys = Object.keys(JSON.parse(empty.stdout)).sort();

    await seedCache(dataDir, makeCache(utcToday()));
    const full = await runCli(["--json", "today"], { dataDir, env: { TZ: "UTC" } });
    expect(full.exitCode).toBe(0);
    const fullKeys = Object.keys(JSON.parse(full.stdout)).sort();

    expect(emptyKeys).toEqual(fullKeys);
  }, 20_000);

  // Durable recovery: a successful journal append can outlive its cache write
  // (cache never written, or quarantined as corrupt). The journal is the durable
  // record — the hook recovers from it the same way — so `today` must surface
  // today's reading from history.jsonl rather than claim "no reading yet".
  test("recovers today's reading from the journal when the cache is missing", async () => {
    await seedJournal(dataDir, [todayEntry()]); // no daily-cache.json written
    const { exitCode, stdout } = await runCli(["today"], { dataDir, env: { TZ: "UTC" } });
    expect(exitCode).toBe(0);
    expect(stdout).not.toContain("no reading yet today");
    expect(stdout).toContain(`Date: ${utcToday()}`);
    expect(stdout).toContain("Intention: recovered from history");
    expect(stdout).toContain("屯");
    expect(stdout).toContain("Hexagram 3");
    expect(stdout).toContain("Becoming:");
    expect(stdout).toContain("比");
    expect(stdout).toContain("Reading (啟蒙):"); // structure rebuilt from the cast
  }, 20_000);

  test("a stale cache does not hide today's journal reading", async () => {
    await seedCache(dataDir, makeCache("2001-01-01")); // yesterday's cache lingers…
    await seedJournal(dataDir, [todayEntry()]); // …but history holds today
    const { exitCode, stdout } = await runCli(["today"], { dataDir, env: { TZ: "UTC" } });
    expect(exitCode).toBe(0);
    expect(stdout).not.toContain("no reading yet today");
    expect(stdout).toContain("Hexagram 3");
  }, 20_000);

  test("--json recovers today's reading from the journal", async () => {
    await seedJournal(dataDir, [todayEntry()]);
    const { exitCode, stdout } = await runCli(["--json", "today"], { dataDir, env: { TZ: "UTC" } });
    expect(exitCode).toBe(0);
    const payload = JSON.parse(stdout);
    expect(payload.date).toBe(utcToday());
    expect(payload.primary.number).toBe(3);
    expect(payload.becoming.number).toBe(8);
    expect(payload.method).toBe("yarrow");
    expect(payload.intention).toBe("recovered from history");
  }, 20_000);
});
