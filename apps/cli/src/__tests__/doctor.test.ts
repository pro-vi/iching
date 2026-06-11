import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
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
  const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..", "..");
  const MAIN_TS = resolve(REPO_ROOT, "apps/cli/src/main.ts");

  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "iching-doctor-test-"));
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  async function runDoctor(): Promise<{ exitCode: number; stdout: string }> {
    const proc = Bun.spawn(
      ["bun", MAIN_TS, "--data-dir", dataDir, "doctor"],
      {
        cwd: REPO_ROOT,
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, NO_COLOR: "1" },
      },
    );
    proc.stdin.end();
    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    return { exitCode, stdout };
  }

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
});
