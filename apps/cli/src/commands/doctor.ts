import { Command } from "commander";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { GUA, BINARY_TO_KW, TRIGRAMS } from "@iching/core";
import { resolvePaths, JsonlJournalStore, isCacheShaped } from "@iching/storage";
import { outputJson } from "../output/json.js";

interface CheckResult {
  name: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

function checkGlyphs(): CheckResult {
  const trigrams = "☰☱☲☳☴☵☶☷";
  const lines = "━━━━━━━ ━━━ ━━━";

  // Basic check: all trigram symbols exist in our data
  const allPresent = TRIGRAMS.every((t) => trigrams.includes(t.sym));

  return {
    name: "Glyphs",
    status: allPresent ? "pass" : "warn",
    detail: allPresent
      ? `Trigrams: ${trigrams}  Lines: ${lines}`
      : "Some trigram glyphs may not render correctly",
  };
}

function checkData(): CheckResult {
  const guaCount = GUA.length;
  const binaryCount = BINARY_TO_KW.length;

  const guaOk = guaCount === 64;
  const binaryOk = binaryCount === 64;

  // Verify BINARY_TO_KW maps to valid KW numbers
  const allValid = BINARY_TO_KW.every((kw) => kw >= 1 && kw <= 64);

  // Verify uniqueness
  const unique = new Set(BINARY_TO_KW).size === 64;

  const ok = guaOk && binaryOk && allValid && unique;

  return {
    name: "Data",
    status: ok ? "pass" : "fail",
    detail: ok
      ? `GUA: ${guaCount} entries, BINARY_TO_KW: ${binaryCount} entries, alignment verified`
      : `GUA: ${guaCount}/64, BINARY_TO_KW: ${binaryCount}/64, valid=${allValid}, unique=${unique}`,
  };
}

function checkColor(): CheckResult {
  const colorterm = process.env.COLORTERM ?? "";
  const term = process.env.TERM ?? "";
  const noColor = process.env.NO_COLOR;

  if (noColor !== undefined) {
    return {
      name: "Color",
      status: "warn",
      detail: `NO_COLOR is set — color output disabled`,
    };
  }

  let level: string;
  if (colorterm === "truecolor" || colorterm === "24bit") {
    level = "truecolor (24-bit)";
  } else if (colorterm === "256color" || term.includes("256color")) {
    level = "256-color";
  } else if (term) {
    level = "basic (16-color)";
  } else {
    level = "unknown";
  }

  return {
    name: "Color",
    status: level === "unknown" ? "warn" : "pass",
    detail: `COLORTERM=${colorterm || "(unset)"}, TERM=${term || "(unset)"} → ${level}`,
  };
}

function checkTerminal(): CheckResult {
  const cols = process.stdout.columns ?? 0;
  const rows = process.stdout.rows ?? 0;

  const wide = cols >= 80;

  return {
    name: "Terminal",
    status: wide ? "pass" : "warn",
    detail: `${cols} x ${rows}${!wide ? " (< 80 columns — some output may wrap)" : ""}`,
  };
}

function checkPaths(dataDir?: string): CheckResult {
  const paths = resolvePaths(dataDir ? { dataDir } : undefined);
  const configExists = existsSync(paths.config);
  const stateExists = existsSync(paths.state);
  const cacheExists = existsSync(paths.cache);

  const lines = [
    `Config: ${paths.config} ${configExists ? "[exists]" : "[not found]"}`,
    `State:  ${paths.state} ${stateExists ? "[exists]" : "[not found]"}`,
    `Cache:  ${paths.cache} ${cacheExists ? "[exists]" : "[not found]"}`,
  ];

  return {
    name: "Paths",
    status: "pass",
    detail: lines.join("\n         "),
  };
}

async function checkJournal(dataDir?: string): Promise<CheckResult> {
  const paths = resolvePaths(dataDir ? { dataDir } : undefined);
  if (!existsSync(paths.state)) {
    return {
      name: "Journal",
      status: "pass",
      detail: "no journal yet — cast in the TUI to begin",
    };
  }

  // Stream the whole journal so torn/malformed lines surface as a count —
  // path existence alone says nothing about whether the entries still read.
  const journal = new JsonlJournalStore(paths.state);
  let entryCount = 0;
  try {
    for await (const _entry of journal.stream()) {
      entryCount++;
    }
  } catch {
    // The journal exists but can't be read at all — a directory at the path,
    // permission denied. The diagnostic must REPORT that as a failed check, not
    // crash on the very read failure it exists to surface. (Torn LINES are a
    // warn below; a whole-file failure is a fail.)
    return {
      name: "Journal",
      status: "fail",
      detail: "exists but can't be read (permission denied, or not a file?)",
    };
  }

  const skipped = journal.skippedLines;
  const counts = `${entryCount} reading(s) recorded`;
  if (skipped > 0) {
    // Damage is a warning, not a failure: the surrounding readings remain
    // intact and every reader skips torn lines without crashing.
    return {
      name: "Journal",
      status: "warn",
      detail: `${counts}, ${skipped} unreadable line(s) skipped`,
    };
  }
  return { name: "Journal", status: "pass", detail: counts };
}

/**
 * Validity check for a JSON data file (config, daily cache) — the diagnostic
 * twin of checkJournal for the single-object stores. The journal is stream-
 * validated; these were only existence-checked, so a corrupt config/cache read
 * as "[exists]" (healthy) when it would actually reset on next use. NON-MUTATING
 * on purpose: a raw read + JSON.parse, never the store's read() (which would
 * quarantine/seed as a side effect — a diagnostic must inspect, not repair).
 * An optional isShaped predicate catches the subtler corruption: a file that
 * parses cleanly yet isn't a usable record, which the store would quarantine
 * and reset. Passed for the cache; config is permissive and takes none.
 */
async function checkJsonFile(
  name: string,
  path: string,
  isShaped?: (parsed: unknown) => boolean,
): Promise<CheckResult> {
  if (!existsSync(path)) {
    return { name, status: "pass", detail: "not present yet — uses defaults" };
  }
  let raw: string;
  try {
    raw = await readFile(path, "utf-8");
  } catch {
    return { name, status: "fail", detail: "exists but can't be read (permission denied, or not a file?)" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Self-healing (the store quarantines and starts fresh), so a warning, not a
    // failure — but a user running doctor to understand a reset deserves to see it.
    return { name, status: "warn", detail: "corrupt JSON — resets to defaults on next use" };
  }
  if (isShaped && !isShaped(parsed)) {
    // Parseable but not a usable record — the store will quarantine and reset it
    // on next use, exactly like corrupt bytes, so surface it the same calm way.
    return { name, status: "warn", detail: "valid JSON but not a usable record — resets to defaults on next use" };
  }
  return { name, status: "pass", detail: "valid" };
}

async function checkConfig(dataDir?: string): Promise<CheckResult> {
  const paths = resolvePaths(dataDir ? { dataDir } : undefined);
  return checkJsonFile("Config", paths.config);
}

async function checkCache(dataDir?: string): Promise<CheckResult> {
  const paths = resolvePaths(dataDir ? { dataDir } : undefined);
  // Pass the store's own shape predicate: a parseable but non-record cache (e.g.
  // just `{"date":…}`) would be quarantined and reset, so it is not "valid".
  // Config takes none — its loader merges known keys onto defaults, never resets.
  return checkJsonFile("Cache", paths.cache, isCacheShaped);
}

const STATUS_ICONS: Record<string, string> = {
  pass: "OK",
  warn: "WARN",
  fail: "FAIL",
};

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Verify environment and configuration")
    .action(async () => {
      const globalOpts = program.opts();
      const checks: CheckResult[] = [
        checkGlyphs(),
        checkData(),
        checkColor(),
        checkTerminal(),
        checkPaths(globalOpts.dataDir),
        await checkJournal(globalOpts.dataDir),
        await checkConfig(globalOpts.dataDir),
        await checkCache(globalOpts.dataDir),
      ];

      if (globalOpts.json) {
        outputJson(checks);
        // Parity with the human path's exit(1): a script reading --json must be
        // able to branch on the exit code, not re-derive failure from the
        // payload. Set exitCode (not exit()) so the JSON flushes first.
        if (checks.some((c) => c.status === "fail")) process.exitCode = 1;
        return;
      }

      console.log("I Ching Doctor\n");
      for (const check of checks) {
        const icon = STATUS_ICONS[check.status];
        console.log(`  [${icon}] ${check.name}: ${check.detail}`);
      }
      console.log("");

      const failures = checks.filter((c) => c.status === "fail");
      const warnings = checks.filter((c) => c.status === "warn");

      if (failures.length > 0) {
        console.log(
          `${failures.length} check(s) failed. Please review the output above.`,
        );
        process.exit(1);
      } else if (warnings.length > 0) {
        console.log(
          `All checks passed with ${warnings.length} warning(s).`,
        );
      } else {
        console.log("All checks passed.");
      }
    });
}
