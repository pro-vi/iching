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

  test("gcEnW (the displayed Wilhelm judgment) is a required, AR-001-sanctioned field-class", () => {
    // gcEnW is rendered English corpus (cast/today/journal-show reading); it must
    // carry an inventory field-class row AND be sanctioned, or a new English
    // judgment register ships unrepresented in the language contract.
    expect(src).toContain('"core-gua-gcEnW"');
    expect(src).toContain('["gcEnW:", "core-gua-gcEnW"]');
  });

  test("the 君子 harmonization scan covers the Wilhelm judgments (judgment-wilhelm.ts)", () => {
    // gcEnW is interpretive English (Wilhelm's idiom is 'the superior man'), so
    // C-004 binds it; the scan must read its source file, not only gua.ts.
    expect(src).toContain('readMaybe("packages/core/src/data/judgment-wilhelm.ts")');
  });

  test("the zh-Hans residue scan reaches extra.name/extra.text (object, not string)", () => {
    // extra is an OBJECT on 乾/坤 (用九/用六); the old `typeof === 'string'` test
    // never fired, so its Chinese escaped the traditional-residue scan.
    expect(src).toContain("ex.name");
    expect(src).toContain("ex.text");
  });

  test("--inventory-only passes with today.ts scanned", () => {
    expect(runVerifier(["--inventory-only"])).toBe(0);
  }, 30_000);

  test("--terminal passes with the entropy contract enforced", () => {
    expect(runVerifier(["--terminal"])).toBe(0);
  }, 30_000);
});
