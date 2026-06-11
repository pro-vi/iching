// Regression: a bare `bun run smoke` used to fail with a usage error because
// scripts/smoke-test.ts required argv[2]. It now defaults to the current
// platform's build artifact (dist/iching-<platform>-<arch>) and fails with a
// friendly "build it first" pointer when that artifact is missing.

import { describe, test, expect } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..", "..");
const SMOKE_TS = resolve(REPO_ROOT, "scripts/smoke-test.ts");

async function runSmoke(
  cwd: string,
  args: string[] = [],
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(["bun", SMOKE_TS, ...args], {
    cwd,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, NO_COLOR: "1" },
  });
  proc.stdin.end();
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { exitCode, stdout, stderr };
}

describe("smoke-test script", () => {
  test("bare run without a build artifact fails with a friendly pointer", async () => {
    // A cwd with no dist/ — the default artifact cannot exist here.
    const dir = await mkdtemp(join(tmpdir(), "iching-smoke-default-"));
    try {
      const { exitCode, stderr } = await runSmoke(dir);
      expect(exitCode).toBe(1);
      expect(stderr).toContain(`iching-${process.platform}-${process.arch}`);
      expect(stderr).toContain("bun run build");
      expect(stderr).not.toContain("Usage: bun scripts/smoke-test.ts <path-to-binary>");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 20_000);

  test("explicit path that does not exist fails before any smoke runs", async () => {
    const dir = await mkdtemp(join(tmpdir(), "iching-smoke-explicit-"));
    try {
      const { exitCode, stdout, stderr } = await runSmoke(dir, ["no/such/binary"]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("Binary not found: no/such/binary");
      expect(stdout).not.toContain("Smoke testing:");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 20_000);
});
