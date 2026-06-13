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

  // Regression: Number("abc") is NaN, slice(0, NaN) is [] — garbage --limit
  // used to print "No readings found." (exit 0) with data present, and
  // --limit -1 silently dropped the oldest entry.
  test("list --limit rejects non-numeric, zero, negative, and fractional values", async () => {
    await seedJournal(dataDir, [makeEntry("2026-01-01", 1, null)]);
    for (const bad of ["abc", "0", "-1", "3.5"]) {
      const { exitCode, stdout, stderr } = await runCli(dataDir, [
        "journal", "list", "--limit", bad,
      ]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain(`Invalid --limit "${bad}"`);
      expect(stdout).not.toContain("No readings found.");
    }
  }, 20_000);

  test("list --limit still truncates to the most recent N", async () => {
    await seedJournal(dataDir, [
      makeEntry("2026-01-01", 1, null),
      makeEntry("2026-01-02", 2, null),
      makeEntry("2026-01-03", 3, null),
    ]);
    const { exitCode, stdout } = await runCli(dataDir, ["journal", "list", "--limit", "2"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("2026-01-03");
    expect(stdout).toContain("2026-01-02");
    expect(stdout).not.toContain("2026-01-01");
  }, 20_000);

  test("list --limit takes the latest-DATED, not the last-recorded (out-of-order)", async () => {
    // An old reading recorded AFTER newer ones (imported/merged). A plain
    // reverse() would float it to the top and into --limit; ordering by the
    // pane's time-key must not — matching the TUI list and the ◉ recency accent.
    await seedJournal(dataDir, [
      makeEntry("2026-02-01", 1, null), // newer
      makeEntry("2026-02-02", 2, null), // newest by date
      makeEntry("2026-01-10", 3, null), // OLD, recorded last (the import)
    ]);
    const { exitCode, stdout } = await runCli(dataDir, ["journal", "list", "--limit", "2"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("2026-02-02"); // the two latest-dated…
    expect(stdout).toContain("2026-02-01");
    expect(stdout).not.toContain("2026-01-10"); // …not the late old import
  }, 20_000);

  // Regression: --since was never format-validated — the lexicographic
  // compare against "notadate" filtered every entry out (exit 0).
  test("list --since rejects non-YYYY-MM-DD values", async () => {
    await seedJournal(dataDir, [makeEntry("2026-01-01", 1, null)]);
    for (const bad of ["notadate", "2026/01/01", "yesterday", "2026-1-1"]) {
      const { exitCode, stdout, stderr } = await runCli(dataDir, [
        "journal", "list", "--since", bad,
      ]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain(`Invalid --since "${bad}"`);
      expect(stdout).not.toContain("No readings found.");
    }
  }, 20_000);

  test("list --since with a valid date filters older entries", async () => {
    await seedJournal(dataDir, [
      makeEntry("2026-01-01", 1, null),
      makeEntry("2026-01-03", 3, null),
    ]);
    const { exitCode, stdout } = await runCli(dataDir, [
      "journal", "list", "--since", "2026-01-02",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("2026-01-03");
    expect(stdout).not.toContain("2026-01-01");
  }, 20_000);

  test("list --until rejects non-YYYY-MM-DD values", async () => {
    await seedJournal(dataDir, [makeEntry("2026-01-01", 1, null)]);
    for (const bad of ["notadate", "2026/01/01", "2026-1-1"]) {
      const { exitCode, stderr } = await runCli(dataDir, ["journal", "list", "--until", bad]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain(`Invalid --until "${bad}"`);
    }
  }, 20_000);

  test("list --since/--until bound a window (both inclusive)", async () => {
    await seedJournal(dataDir, [
      makeEntry("2026-01-01", 1, null),
      makeEntry("2026-02-15", 2, null), // 賁-era, inside the window
      makeEntry("2026-04-01", 3, null),
    ]);
    const { exitCode, stdout } = await runCli(dataDir, [
      "journal", "list", "--since", "2026-02-01", "--until", "2026-03-01",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("2026-02-15"); // inside the window
    expect(stdout).not.toContain("2026-01-01"); // before --since
    expect(stdout).not.toContain("2026-04-01"); // after --until
  }, 20_000);

  test("an inverted --since/--until window fails loudly, not as an empty result", async () => {
    await seedJournal(dataDir, [makeEntry("2026-02-15", 1, null)]);
    // list: clear error instead of "No readings found."
    const list = await runCli(dataDir, [
      "journal", "list", "--since", "2026-05-01", "--until", "2026-03-01",
    ]);
    expect(list.exitCode).toBe(1);
    expect(list.stderr).toContain('Invalid range: --since "2026-05-01" is after --until "2026-03-01"');
    expect(list.stdout).not.toContain("No readings found.");
    // patterns: clear error instead of the calm "No readings to observe yet."
    const pat = await runCli(dataDir, [
      "journal", "patterns", "--since", "2026-05-01", "--until", "2026-03-01",
    ]);
    expect(pat.exitCode).toBe(1);
    expect(pat.stderr).toContain("Invalid range:");
    expect(pat.stdout).not.toContain("No readings to observe yet");
  }, 20_000);

  test("a bounded patterns report discloses its window and drops now-relative copy", async () => {
    await seedJournal(dataDir, [
      makeEntry("2023-02-10", 1, null),
      makeEntry("2023-02-20", 2, null),
    ]);
    // Historical window (ends in the past): disclose the period, drop "this month".
    const hist = await runCli(dataDir, [
      "journal", "patterns", "--since", "2023-01-01", "--until", "2023-12-31",
    ]);
    expect(hist.exitCode).toBe(0);
    expect(hist.stdout).toContain("Observing 2023-01-01 through 2023-12-31");
    expect(hist.stdout).not.toContain("this month"); // now-relative, out of frame

    // Open-ended --since (window includes now): disclose, but "this month" stays.
    const open = await runCli(dataDir, ["journal", "patterns", "--since", "2023-01-01"]);
    expect(open.exitCode).toBe(0);
    expect(open.stdout).toContain("Observing 2023-01-01 through now");
    expect(open.stdout).toContain("this month");

    // No window: no disclosure line at all.
    const all = await runCli(dataDir, ["journal", "patterns"]);
    expect(all.stdout).not.toContain("Observing");
  }, 20_000);

  test("patterns --until bounds the observation to a past period", async () => {
    await seedJournal(dataDir, [
      makeEntry("2026-01-10", 1, null),
      makeEntry("2026-01-20", 2, null),
      makeEntry("2026-06-01", 3, null), // outside — must not count
    ]);
    const { exitCode, stdout } = await runCli(dataDir, [
      "--json", "journal", "patterns", "--until", "2026-02-01",
    ]);
    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout).total).toBe(2); // only the two within the window
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

  test("show <date> surfaces the day's LATEST reading, even appended out of order", async () => {
    // Three readings on one day, appended out of chronological order (as an
    // imported journal can be). `show` must surface the latest by time-key, not
    // whichever was appended last.
    await seedJournal(dataDir, [
      { date: "2026-02-01", timestamp: "2026-02-01T20:00:00.000Z", cast: makeCast(29, null), method: "coin" },
      { date: "2026-02-01", timestamp: "2026-02-01T08:00:00.000Z", cast: makeCast(1, null), method: "coin" },
      { date: "2026-02-01", timestamp: "2026-02-01T14:00:00.000Z", cast: makeCast(11, null), method: "coin" },
    ]);
    const { exitCode, stdout } = await runCli(dataDir, ["journal", "show", "2026-02-01"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Hexagram 29"); // 坎, the 20:00 reading — the latest…
    expect(stdout).not.toContain("Hexagram 11"); // …not the 14:00 one appended last
  }, 20_000);

  test("plain show carries the quiet entropy line only for bound entries", async () => {
    const bound: HistoryEntry = {
      ...makeEntry("2026-01-03", 3, null, "coin"),
      rng: { source: "bound", intentionBound: true },
    };
    const crypto: HistoryEntry = {
      ...makeEntry("2026-01-04", 4, null, "coin"),
      rng: { source: "crypto", intentionBound: false },
    };
    await seedJournal(dataDir, [bound, crypto]);

    const boundShow = await runCli(dataDir, ["journal", "show", "2026-01-03"]);
    expect(boundShow.stdout).toContain(
      "Entropy: local machine entropy, bound to the intention and moment.",
    );

    // Plain crypto (and legacy entries with no rng) stay silent.
    const cryptoShow = await runCli(dataDir, ["journal", "show", "2026-01-04"]);
    expect(cryptoShow.stdout).not.toContain("Entropy:");
  }, 20_000);

  test("show --json carries the rng block through unchanged", async () => {
    const bound: HistoryEntry = {
      ...makeEntry("2026-01-05", 5, null, "coin"),
      rng: { source: "bound", intentionBound: false },
    };
    await seedJournal(dataDir, [bound]);
    const { exitCode, stdout } = await runCli(dataDir, ["--json", "journal", "show", "latest"]);
    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout).rng).toEqual({ source: "bound", intentionBound: false });
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

  // Torn-line damage is surfaced, not hidden: a one-line stderr note after
  // list/show says how many lines were skipped. Clean journals stay silent.
  test("list and show note skipped unreadable lines on stderr", async () => {
    await seedJournal(dataDir, [makeEntry("2026-01-01", 1, null)]);
    await appendFile(join(dataDir, "history.jsonl"), '{"date":"2026-01-0', "utf-8");

    const list = await runCli(dataDir, ["journal", "list"]);
    expect(list.exitCode).toBe(0);
    expect(list.stderr).toContain("note: 1 unreadable journal line(s) skipped");

    const show = await runCli(dataDir, ["journal", "show", "latest"]);
    expect(show.exitCode).toBe(0);
    expect(show.stderr).toContain("note: 1 unreadable journal line(s) skipped");

    // --json keeps stdout parseable; the note stays on stderr.
    const json = await runCli(dataDir, ["--json", "journal", "list"]);
    expect(JSON.parse(json.stdout)).toHaveLength(1);
    expect(json.stderr).toContain("unreadable journal line(s) skipped");
  }, 20_000);

  test("list and show stay silent on stderr for a clean journal", async () => {
    await seedJournal(dataDir, [makeEntry("2026-01-01", 1, null)]);

    const list = await runCli(dataDir, ["journal", "list"]);
    expect(list.exitCode).toBe(0);
    expect(list.stderr).toBe("");

    const show = await runCli(dataDir, ["journal", "show", "latest"]);
    expect(show.exitCode).toBe(0);
    expect(show.stderr).toBe("");
  }, 20_000);

  // Regression: a syntactically valid record with an empty cast object used
  // to pass the per-line guard and crash `journal list` resolving
  // GUA[entry.cast.primary - 1] / entry.cast.becoming names. Malformed
  // records now count as skipped lines, like torn ones.
  test("list and show survive a record whose cast is an empty object", async () => {
    await seedJournal(dataDir, [makeEntry("2026-01-01", 1, null)]);
    await appendFile(
      join(dataDir, "history.jsonl"),
      '{"date":"2026-01-02","cast":{}}\n',
      "utf-8",
    );

    const list = await runCli(dataDir, ["journal", "list"]);
    expect(list.exitCode).toBe(0);
    expect(list.stdout).toContain("2026-01-01");
    expect(list.stderr).toContain("note: 1 unreadable journal line(s) skipped");

    const show = await runCli(dataDir, ["journal", "show", "latest"]);
    expect(show.exitCode).toBe(0);
    expect(show.stdout).toContain("2026-01-01");

    const json = await runCli(dataDir, ["--json", "journal", "list"]);
    expect(json.exitCode).toBe(0);
    expect(JSON.parse(json.stdout)).toHaveLength(1);
  }, 20_000);

  test("patterns digests the journal in plain text and resolved-name JSON", async () => {
    await seedJournal(dataDir, [
      makeEntry("2026-02-01", 3, 8, "coin"),
      makeEntry("2026-02-05", 3, 39, "yarrow"),
      makeEntry("2026-02-10", 2, null, "coin"),
    ]);

    const plain = await runCli(dataDir, ["journal", "patterns"]);
    expect(plain.exitCode).toBe(0);
    expect(plain.stdout).toContain("3 readings");
    expect(plain.stdout).toContain("Most seen:");
    expect(plain.stdout).toContain("屯"); // KW3, the twice-seen primary
    expect(plain.stdout).toContain("Two modes (兩儀)");

    const json = await runCli(dataDir, ["--json", "journal", "patterns"]);
    expect(json.exitCode).toBe(0);
    const p = JSON.parse(json.stdout);
    expect(p.total).toBe(3);
    // A basis note tells a script not to cross descriptive counts with the
    // method-marked comparison block.
    expect(p.basis).toContain("method-marked");
    // kw references resolve to name blocks for a caller without the data table.
    expect(p.field.recent).toMatchObject({ kw: 2, n: "坤" }); // latest is 02-10
    // Descriptive count at the top; the chance comparison namespaced + same-basis.
    expect(p.topHexagrams[0]).toMatchObject({ kw: 3, n: "屯", count: 2 });
    expect(p.topHexagrams[0]).not.toHaveProperty("expected"); // not adjacent to count
    expect(p.topHexagrams[0].comparison).toMatchObject({ basis: "method-marked", count: 2 });
    // The same comparison discipline holds for moving-line surfaces: a
    // descriptive count, the chance figure namespaced (never adjacent).
    expect(p.movingLines[0]).not.toHaveProperty("expected");
    expect(p.movingLines[0]).toHaveProperty("comparison");
    expect(p.movingLineCounts[0]).not.toHaveProperty("expected");
    expect(p.movingLineCounts[0]).toHaveProperty("comparison");
    // trigrams follow the SAME discipline now (no longer an all-readings
    // exception): descriptive count + a method-marked comparison block.
    expect(p.topTrigrams[0]).not.toHaveProperty("expected");
    expect(p.topTrigrams[0]).not.toHaveProperty("lift");
    expect(p.topTrigrams[0]).toHaveProperty("count");
    expect(p.topTrigrams[0].comparison).toMatchObject({ basis: "method-marked" });
    // diversity: descriptive spread at top, the distinct/repeats comparison
    // namespaced — distinctHexagrams (all) is never adjacent to a method-only
    // expectedDistinctHexagrams.
    expect(p.diversity).toHaveProperty("distinctHexagrams");
    expect(p.diversity).not.toHaveProperty("expectedDistinctHexagrams");
    expect(p.diversity.comparison).toMatchObject({ basis: "method-marked" });
    // baseline: descriptive method counts; every method-marked chance figure
    // (per-hexagram expectation + old-line comparisons) namespaced together, so
    // no loose method-marked scalar sits where field.counts could be divided by it.
    expect(p.baseline).not.toHaveProperty("primaryExpectedPerHexagram");
    expect(p.baseline.comparison).toMatchObject({ basis: "method-marked" });
    expect(p.baseline.comparison).toHaveProperty("expectedPerHexagram");
    // Uniform comparison shape — count/expected/lift everywhere (the README's
    // "use the block's own count" holds for baseline too), not observed/residual.
    expect(p.baseline.comparison.oldYang).toHaveProperty("count");
    expect(p.baseline.comparison.oldYang).not.toHaveProperty("observed");
    expect(p.baseline.comparison.oldYang).not.toHaveProperty("residual");
    expect(p.lineBalance).toHaveProperty("yang");
    expect(p.lineBalance).toHaveProperty("yin");
  }, 20_000);

  test("JSON diversity comparison rests on the method-marked subset, not all readings", async () => {
    // Contract-boundary lock for the basis discipline (GPT-Pro review: the
    // observed side of a chance comparison must share the method-marked basis
    // of its expectation, never cross an all-readings count with a method-only
    // expectation). The core derivation is tested with mixed methods in
    // journal-patterns.test.ts; this guards the json.ts MAPPING — that it routes
    // the method-marked distinct into the comparison block, not the descriptive
    // one. Earlier all-marked fixtures couldn't catch a swapped field because
    // both counts coincide; here unknown-method readings make them diverge.
    await seedJournal(dataDir, [
      // 8 method-marked readings, all hexagram 1 → method-marked distinct = 1.
      ...Array.from({ length: 8 }, (_, i) =>
        makeEntry(`2026-02-${String(i + 1).padStart(2, "0")}`, 1, null, "coin"),
      ),
      // 4 unknown-method readings over NEW hexagrams → descriptive distinct += 4.
      makeEntry("2026-02-20", 20, null),
      makeEntry("2026-02-21", 21, null),
      makeEntry("2026-02-22", 22, null),
      makeEntry("2026-02-23", 23, null),
    ]);
    const json = await runCli(dataDir, ["--json", "journal", "patterns"]);
    expect(json.exitCode).toBe(0);
    const p = JSON.parse(json.stdout);
    expect(p.total).toBe(12);
    // Descriptive spread spans ALL readings: {1, 20, 21, 22, 23} = 5 distinct.
    expect(p.diversity.distinctHexagrams).toBe(5);
    // The comparison's OBSERVED distinct is the method-marked subset only (the
    // 8 hexagram-1 casts) = 1 — never the descriptive 5.
    expect(p.diversity.comparison.distinctHexagrams).toBe(1);
    // …and its EXPECTED rests on the method-marked count n=8, not n=12:
    // 64·(1−(63/64)^8) ≈ 7.56 (n=12 would give ≈11.0), so 7 < x < 8 proves the
    // expectation used the known subset, sharing the observed side's basis.
    expect(p.diversity.comparison.expectedDistinctHexagrams).toBeGreaterThan(7);
    expect(p.diversity.comparison.expectedDistinctHexagrams).toBeLessThan(8);
  }, 20_000);

  test("patterns plain text says '1 reading' (singular) for a lone entry", async () => {
    await seedJournal(dataDir, [makeEntry("2026-02-01", 3, 8, "coin")]);
    const plain = await runCli(dataDir, ["journal", "patterns"]);
    expect(plain.exitCode).toBe(0);
    expect(plain.stdout).toContain("1 reading ·"); // singular unit, not "1 readings"
    expect(plain.stdout).not.toContain("1 readings");
  }, 20_000);

  test("patterns surfaces the 時 phase-of-day shape once enough readings are timed", async () => {
    // makeEntry stamps every record with a real timestamp, so five readings
    // clear the timestamped floor. Buckets are local (tz-dependent), so assert
    // the tz-free facts: the line is present, names the honest population, and
    // its four phase counts sum to that population.
    await seedJournal(dataDir, [
      makeEntry("2026-02-01", 1, null),
      makeEntry("2026-02-02", 2, null),
      makeEntry("2026-02-03", 3, null),
      makeEntry("2026-02-04", 4, null),
      makeEntry("2026-02-05", 5, null),
    ]);

    const plain = await runCli(dataDir, ["journal", "patterns"]);
    expect(plain.exitCode).toBe(0);
    expect(plain.stdout).toContain("Phase of day (over 5 timed):");

    const json = await runCli(dataDir, ["--json", "journal", "patterns"]);
    const p = JSON.parse(json.stdout);
    expect(p.timeOfDay).not.toBeNull();
    expect(p.timeOfDay.timestamped).toBe(5);
    const sum = p.timeOfDay.dawn + p.timeOfDay.midday + p.timeOfDay.dusk + p.timeOfDay.night;
    expect(sum).toBe(5);
  }, 20_000);

  test("patterns on an empty journal is a calm state, not an error", async () => {
    await seedJournal(dataDir, []);
    const plain = await runCli(dataDir, ["journal", "patterns"]);
    expect(plain.exitCode).toBe(0);
    expect(plain.stdout).toContain("No readings to observe yet");

    const json = await runCli(dataDir, ["--json", "journal", "patterns"]);
    expect(json.exitCode).toBe(0);
    expect(JSON.parse(json.stdout).total).toBe(0);
  }, 20_000);

  test("patterns rejects a malformed --since", async () => {
    await seedJournal(dataDir, [makeEntry("2026-02-01", 1, null, "coin")]);
    const { exitCode, stderr } = await runCli(dataDir, ["journal", "patterns", "--since", "nope"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Invalid --since");
  }, 20_000);
});

// Reflection notes — `journal note` appends a kind:"note" line; `journal show`
// prints notes beneath the reading; JSON stays additive.
describe("journal note command", () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "iching-journal-note-test-"));
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  test("note annotates the latest reading and show prints it beneath", async () => {
    await seedJournal(dataDir, [
      makeEntry("2026-01-01", 1, null),
      makeEntry("2026-01-02", 39, null),
    ]);

    const noted = await runCli(dataDir, ["journal", "note", "it resolved itself"]);
    expect(noted.exitCode).toBe(0);
    expect(noted.stdout).toContain("Note added to 2026-01-02");
    expect(noted.stdout).toContain("蹇");

    const show = await runCli(dataDir, ["journal", "show", "2026-01-02"]);
    expect(show.exitCode).toBe(0);
    expect(show.stdout).toContain("Notes:");
    expect(show.stdout).toContain("it resolved itself");

    // The other reading stays unannotated
    const other = await runCli(dataDir, ["journal", "show", "2026-01-01"]);
    expect(other.stdout).not.toContain("Notes:");
  }, 20_000);

  test("note --date annotates a past day's reading", async () => {
    await seedJournal(dataDir, [
      makeEntry("2026-01-01", 1, null),
      makeEntry("2026-01-02", 2, null),
    ]);

    const noted = await runCli(dataDir, [
      "journal", "note", "what happened after", "--date", "2026-01-01",
    ]);
    expect(noted.exitCode).toBe(0);
    expect(noted.stdout).toContain("Note added to 2026-01-01");

    const show = await runCli(dataDir, ["journal", "show", "2026-01-01"]);
    expect(show.stdout).toContain("what happened after");
  }, 20_000);

  test("note record on disk matches the schema shape", async () => {
    await seedJournal(dataDir, [makeEntry("2026-01-01", 1, null)]);
    await runCli(dataDir, ["journal", "note", "shape check"]);

    const { readFile } = await import("node:fs/promises");
    // Notes live in the notes.jsonl sidecar so pre-note binaries reading
    // history.jsonl never meet a record shape they cannot parse.
    const raw = await readFile(join(dataDir, "notes.jsonl"), "utf-8");
    const lines = raw.trim().split("\n");
    const note = JSON.parse(lines[lines.length - 1]);
    expect(Object.keys(note).sort()).toEqual(["date", "kind", "ref", "text", "timestamp"]);
    expect(note.kind).toBe("note");
    expect(note.ref).toBe("2026-01-01T09:00:00.000Z");
    expect(note.text).toBe("shape check");

    // And history.jsonl still holds only plain readings (no kind records).
    const history = await readFile(join(dataDir, "history.jsonl"), "utf-8");
    for (const line of history.trim().split("\n")) {
      expect(JSON.parse(line).kind).toBeUndefined();
    }
  }, 20_000);

  test("note errors calmly when there is nothing to annotate", async () => {
    const empty = await runCli(dataDir, ["journal", "note", "into the void"]);
    expect(empty.exitCode).toBe(1);
    expect(empty.stderr).toContain("No reading found to annotate.");

    await seedJournal(dataDir, [makeEntry("2026-01-01", 1, null)]);
    const missing = await runCli(dataDir, [
      "journal", "note", "wrong day", "--date", "2026-02-02",
    ]);
    expect(missing.exitCode).toBe(1);
    expect(missing.stderr).toContain("No reading found for 2026-02-02");

    const blank = await runCli(dataDir, ["journal", "note", "   "]);
    expect(blank.exitCode).toBe(1);
    expect(blank.stderr).toContain("Note text is empty.");
  }, 20_000);

  test("show --json carries notes additively; list stays note-free", async () => {
    await seedJournal(dataDir, [makeEntry("2026-01-01", 1, null)]);
    await runCli(dataDir, ["journal", "note", "json check"]);

    const show = await runCli(dataDir, ["--json", "journal", "show", "latest"]);
    expect(show.exitCode).toBe(0);
    const entry = JSON.parse(show.stdout);
    // Raw fields intact
    expect(entry.date).toBe("2026-01-01");
    expect(entry.cast.primary).toBe(1);
    // Additive notes array
    expect(entry.notes).toHaveLength(1);
    expect(entry.notes[0].text).toBe("json check");
    expect(entry.notes[0].ref).toBe("2026-01-01T09:00:00.000Z");
    expect(typeof entry.notes[0].date).toBe("string");
    expect(typeof entry.notes[0].timestamp).toBe("string");

    // list JSON keeps its existing shape (no notes key)
    const list = await runCli(dataDir, ["--json", "journal", "list"]);
    const entries = JSON.parse(list.stdout);
    expect(entries).toHaveLength(1);
    expect("notes" in entries[0]).toBe(false);
  }, 20_000);

  test("note --json reports the note and the annotated reading", async () => {
    await seedJournal(dataDir, [makeEntry("2026-01-02", 39, null)]);
    const noted = await runCli(dataDir, ["--json", "journal", "note", "machine readable"]);
    expect(noted.exitCode).toBe(0);
    const out = JSON.parse(noted.stdout);
    expect(out.noted.text).toBe("machine readable");
    expect(out.noted.ref).toBe("2026-01-02T09:00:00.000Z");
    expect(out.reading.date).toBe("2026-01-02");
    expect(out.reading.primary.n).toBe("蹇");
  }, 20_000);

  // Control-injection regression: persisted note text is replayed raw to the
  // terminal on every `journal show` — ESC/OSC bytes in a note would replay
  // as live control sequences (window retitle, cursor moves). Stripped at
  // BOTH ends: write time (new records clean at rest) and render time
  // (legacy / hand-edited records replay safely too).
  test("note strips terminal control sequences before persisting", async () => {
    const ESC = String.fromCharCode(0x1b);
    const BEL = String.fromCharCode(0x07);
    await seedJournal(dataDir, [makeEntry("2026-01-01", 1, null)]);

    const noted = await runCli(dataDir, [
      "journal", "note", `${ESC}]0;pwned${BEL}genuine reflection`,
    ]);
    expect(noted.exitCode).toBe(0);

    const { readFile } = await import("node:fs/promises");
    const raw = await readFile(join(dataDir, "notes.jsonl"), "utf-8");
    const record = JSON.parse(raw.trim());
    // Control bytes never reach disk; the printable residue stays.
    expect(record.text).toBe("]0;pwnedgenuine reflection");
    expect(record.text).not.toContain(ESC);
  }, 20_000);

  test("show strips control bytes from legacy hand-edited note records", async () => {
    const ESC = String.fromCharCode(0x1b);
    const BEL = String.fromCharCode(0x07);
    await seedJournal(dataDir, [makeEntry("2026-01-01", 1, null)]);
    // A note written around the CLI (hand-edit / older binary): raw ESC at rest.
    await appendFile(
      join(dataDir, "notes.jsonl"),
      JSON.stringify({
        kind: "note",
        ref: "2026-01-01T09:00:00.000Z",
        date: "2026-01-02",
        timestamp: "2026-01-02T21:00:00.000Z",
        text: `${ESC}]0;pwned${BEL}still readable`,
      }) + "\n",
      "utf-8",
    );

    const show = await runCli(dataDir, ["journal", "show", "2026-01-01"]);
    expect(show.exitCode).toBe(0);
    expect(show.stdout).toContain("still readable");
    expect(show.stdout).not.toContain(ESC);
    expect(show.stdout).not.toContain(BEL);
  }, 20_000);

  test("an all-control note is rejected as empty", async () => {
    const ESC = String.fromCharCode(0x1b);
    await seedJournal(dataDir, [makeEntry("2026-01-01", 1, null)]);
    const noted = await runCli(dataDir, ["journal", "note", `${ESC}${ESC}[2J`]);
    // "[2J" survives the strip — only pure-control text collapses to empty.
    expect(noted.exitCode).toBe(0);

    const blank = await runCli(dataDir, ["journal", "note", `${ESC}`]);
    expect(blank.exitCode).toBe(1);
    expect(blank.stderr).toContain("Note text is empty.");
  }, 20_000);

  test("readings written after a note still stream and show correctly", async () => {
    await seedJournal(dataDir, [makeEntry("2026-01-01", 1, null)]);
    await runCli(dataDir, ["journal", "note", "interleaved"]);
    await appendFile(
      join(dataDir, "history.jsonl"),
      JSON.stringify(makeEntry("2026-01-03", 2, null)) + "\n",
      "utf-8",
    );

    const list = await runCli(dataDir, ["journal", "list"]);
    expect(list.exitCode).toBe(0);
    expect(list.stdout).toContain("2026-01-01");
    expect(list.stdout).toContain("2026-01-03");
    expect(list.stdout).not.toContain("interleaved");

    const latest = await runCli(dataDir, ["journal", "show", "latest"]);
    expect(latest.stdout).toContain("2026-01-03");
  }, 20_000);
});
