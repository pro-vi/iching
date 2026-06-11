// Coverage locks for the language-surface verifier — the gate is only as
// honest as its scan lists. These lock the two coverage gaps closed here:
// the `today` command was absent from the string-sink scan, and the entropy
// chips (settings.entropy.crypto/.bound) were absent from the option-label
// contract. Each lock fails if the coverage is removed again; the subprocess
// runs prove the gate stays green WITH the coverage (genuine pass, not a
// loosened verifier).

import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..", "..");
const VERIFIER = resolve(REPO_ROOT, "scripts/verify-language-surfaces.ts");
const src = readFileSync(VERIFIER, "utf8");

function runVerifier(args: string[]): number {
  const proc = Bun.spawnSync(["bun", VERIFIER, ...args], {
    cwd: REPO_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });
  return proc.exitCode;
}

describe("verify-language-surfaces coverage", () => {
  test("string-sink scan includes the today command surface", () => {
    expect(src).toContain('"apps/cli/src/commands/today.ts"');
  });

  test("option-label contract includes the entropy chips", () => {
    expect(src).toContain('["settings.entropy", "crypto", "機器 (crypto)", "机器 (crypto)"]');
    expect(src).toContain('["settings.entropy", "bound", "繫於心念 (bound)", "系于心念 (bound)"]');
  });

  test("--inventory-only passes with today.ts scanned", () => {
    expect(runVerifier(["--inventory-only"])).toBe(0);
  }, 30_000);

  test("--terminal passes with the entropy contract enforced", () => {
    expect(runVerifier(["--terminal"])).toBe(0);
  }, 30_000);
});
