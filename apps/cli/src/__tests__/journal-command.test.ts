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
    const raw = await readFile(join(dataDir, "history.jsonl"), "utf-8");
    const lines = raw.trim().split("\n");
    const note = JSON.parse(lines[lines.length - 1]);
    expect(Object.keys(note).sort()).toEqual(["date", "kind", "ref", "text", "timestamp"]);
    expect(note.kind).toBe("note");
    expect(note.ref).toBe("2026-01-01T09:00:00.000Z");
    expect(note.text).toBe("shape check");
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
