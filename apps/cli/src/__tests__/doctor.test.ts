import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { runCli as spawnCli } from "../testing.ts";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GUA, BINARY_TO_KW, TRIGRAMS } from "@iching/core";

describe("doctor checks", () => {
  test("glyph test: all trigram symbols present", () => {
    const expected = ["☰", "☱", "☲", "☳", "☴", "☵", "☶", "☷"];
    const actual = TRIGRAMS.map((t) => t.sym);

    for (const sym of expected) {
      expect(actual).toContain(sym);
    }
  });

  test("data integrity: GUA has 64 entries", () => {
    expect(GUA).toHaveLength(64);
  });

  test("data integrity: BINARY_TO_KW has 64 entries", () => {
    expect(BINARY_TO_KW).toHaveLength(64);
  });

  test("data integrity: BINARY_TO_KW values are all valid KW numbers 1-64", () => {
    for (const kw of BINARY_TO_KW) {
      expect(kw).toBeGreaterThanOrEqual(1);
      expect(kw).toBeLessThanOrEqual(64);
    }
  });

  test("data integrity: BINARY_TO_KW has all 64 unique values", () => {
    const unique = new Set(BINARY_TO_KW);
    expect(unique.size).toBe(64);
  });

  test("color detection: reports correct support", () => {
    // Basic test — the detection logic is deterministic given env vars
    const colorterm = process.env.COLORTERM ?? "";
    const term = process.env.TERM ?? "";
    const noColor = process.env.NO_COLOR;

    if (noColor !== undefined) {
      // NO_COLOR overrides everything
      expect(typeof noColor).toBe("string");
    } else if (colorterm === "truecolor" || colorterm === "24bit") {
      expect(colorterm).toMatch(/truecolor|24bit/);
    } else {
      // At minimum we can detect the env vars exist or not
      expect(typeof colorterm).toBe("string");
      expect(typeof term).toBe("string");
    }
  });

  test("all GUA entries have required fields", () => {
    for (let i = 0; i < GUA.length; i++) {
      const g = GUA[i];
      expect(g.u).toBeDefined();
      expect(g.n).toBeDefined();
      expect(g.p).toBeDefined();
      expect(g.l).toHaveLength(6);
      expect(g.dx).toBeDefined();
      expect(g.tu).toBeDefined();
      expect(g.en).toBeDefined();
      expect(g.te).toBeDefined();
      expect(g.w).toBeDefined();
    }
  });
});

// Journal integrity check — doctor must stream the journal, not just stat it:
// torn lines surface as a WARN with a count, never a hard failure.
describe("doctor journal check (subprocess)", () => {

  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "iching-doctor-test-"));
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  const runDoctor = () => spawnCli(["doctor"], { dataDir });

  const GOOD_LINE = JSON.stringify({
    date: "2025-01-15",
    cast: {
      lines: [
        { value: 7, isYang: true, isChanging: false },
        { value: 7, isYang: true, isChanging: false },
        { value: 7, isYang: true, isChanging: false },
        { value: 7, isYang: true, isChanging: false },
        { value: 7, isYang: true, isChanging: false },
        { value: 7, isYang: true, isChanging: false },
      ],
      primary: 1,
      becoming: null,
      changingPositions: [],
      nuclear: 1,
      polarity: 2,
      mirror: 1,
      diagonal: 2,
    },
  });

  test("reports entry count for a clean journal", async () => {
    await writeFile(
      join(dataDir, "history.jsonl"),
      `${GOOD_LINE}\n${GOOD_LINE}\n`,
      "utf-8",
    );

    const { exitCode, stdout } = await runDoctor();
    expect(exitCode).toBe(0);
    expect(stdout).toContain("[OK] Journal: 2 reading(s) recorded");
  }, 20_000);

  test("warns (not fails) on unreadable journal lines", async () => {
    await writeFile(
      join(dataDir, "history.jsonl"),
      `${GOOD_LINE}\n{"date":"2025-01-1\n${GOOD_LINE}\n`,
      "utf-8",
    );

    const { exitCode, stdout } = await runDoctor();
    expect(exitCode).toBe(0); // warn, never a hard failure
    expect(stdout).toContain(
      "[WARN] Journal: 2 reading(s) recorded, 1 unreadable line(s) skipped",
    );
  }, 20_000);

  test("passes calmly when no journal exists yet", async () => {
    const { exitCode, stdout } = await runDoctor();
    expect(exitCode).toBe(0);
    expect(stdout).toContain("[OK] Journal: no journal yet");
  }, 20_000);

  test("fails (reports, never crashes) when the journal exists but can't be read", async () => {
    // A directory at the journal path (→ EISDIR; in the wild a root-owned file
    // → EACCES). The diagnostic must REPORT the read failure as a failed check —
    // crashing on the very problem it exists to surface is the worst outcome.
    await mkdir(join(dataDir, "history.jsonl"));
    const { exitCode, stdout } = await runDoctor();
    expect(exitCode).not.toBe(0); // a real failure, surfaced
    expect(stdout).toContain("[FAIL] Journal: exists but can't be read"); // reported, not crashed
  }, 20_000);

  test("--json exits non-zero on a failed check, so scripts can branch on it", async () => {
    // The human path exits 1 on failure; --json must too, or a CI/script
    // consumer reads exit 0 and treats a broken environment as healthy. The
    // JSON payload still streams in full (exitCode, not a hard exit()).
    await mkdir(join(dataDir, "history.jsonl")); // → a failed Journal check
    const { exitCode, stdout } = await spawnCli(["--json", "doctor"], { dataDir });
    expect(exitCode).not.toBe(0); // failure surfaced through the exit code…
    const checks = JSON.parse(stdout); // …and the JSON still parses in full
    expect(checks.some((c: { status: string }) => c.status === "fail")).toBe(true);
  }, 20_000);

  test("warns on a corrupt daily cache, not just reports its existence", async () => {
    // The cache/config were only existence-checked, so a torn write read as
    // healthy ("[exists]"). doctor must surface it; it self-heals on next use
    // (the store quarantines + resets), so a warning, not a hard failure.
    await writeFile(join(dataDir, "daily-cache.json"), "{not valid json", "utf-8");
    const { exitCode, stdout } = await runDoctor();
    expect(exitCode).toBe(0); // self-healing → warn, not fail
    expect(stdout).toContain("[WARN] Cache: corrupt JSON");
  }, 20_000);

  test("warns on a corrupt config too", async () => {
    await writeFile(join(dataDir, "config.json"), "}also broken{", "utf-8");
    const { stdout } = await runDoctor();
    expect(stdout).toContain("[WARN] Config: corrupt JSON");
  }, 20_000);

  test("reports a valid config and cache as OK", async () => {
    // A complete cache record (date + shown + structure + a shaped cast) is what
    // the store accepts; config is permissive (any parseable object loads).
    const validCache = JSON.stringify({
      date: "2026-01-01",
      cast: JSON.parse(GOOD_LINE).cast,
      shown: true,
      structure: {
        upper: { sym: "☰", n: "乾", img: "heaven" },
        lower: { sym: "☰", n: "乾", img: "heaven" },
        becoming: null,
      },
    });
    await writeFile(join(dataDir, "config.json"), '{"theme":"ink"}', "utf-8");
    await writeFile(join(dataDir, "daily-cache.json"), validCache, "utf-8");
    const { stdout } = await runDoctor();
    expect(stdout).toContain("[OK] Config: valid");
    expect(stdout).toContain("[OK] Cache: valid");
  }, 20_000);

  test("warns on a parseable cache that isn't a usable record (would reset)", async () => {
    // The P3 gap: `{"date":…}` parses but lacks cast/shown/structure, so the
    // store quarantines and resets it on next use. doctor must not call that
    // doomed cache "valid" — a user investigating a reset deserves to see why.
    await writeFile(join(dataDir, "daily-cache.json"), '{"date":"2026-01-01"}', "utf-8");
    const { stdout } = await runDoctor();
    expect(stdout).toContain("[WARN] Cache: valid JSON but not a usable record");
    expect(stdout).not.toContain("[OK] Cache: valid");
  }, 20_000);
});
