import { Command } from "commander";
import { existsSync } from "node:fs";
import { GUA, BINARY_TO_KW, TRIGRAMS } from "@iching/core";
import { resolvePaths } from "@iching/storage";
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

const STATUS_ICONS: Record<string, string> = {
  pass: "OK",
  warn: "WARN",
  fail: "FAIL",
};

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Verify environment and configuration")
    .action(() => {
      const globalOpts = program.opts();
      const checks: CheckResult[] = [
        checkGlyphs(),
        checkData(),
        checkColor(),
        checkTerminal(),
        checkPaths(globalOpts.dataDir),
      ];

      if (globalOpts.json) {
        outputJson(checks);
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
