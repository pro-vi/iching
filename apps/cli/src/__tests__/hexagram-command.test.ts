// Subprocess coverage for the `hexagram` command — number/name lookup, --json,
// --style, and the error/exit-code paths. The resolver (resolveHexagramQuery)
// and the formatter are unit-tested elsewhere; this pins the command WIRING:
// arg parsing, the global --json flag, and the exact exit codes.
import { describe, test, expect } from "bun:test";
import { resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..", "..");
const MAIN_TS = resolve(REPO_ROOT, "apps/cli/src/main.ts");

interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function runCli(args: string[]): Promise<RunResult> {
  const proc = Bun.spawn(["bun", MAIN_TS, ...args], {
    cwd: REPO_ROOT,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, NO_COLOR: "1", TZ: "UTC" },
  });
  proc.stdin.end();
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { exitCode, stdout, stderr };
}

describe("hexagram command", () => {
  test("by King Wen number prints the hexagram", async () => {
    const { exitCode, stdout } = await runCli(["hexagram", "1"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("乾"); // hexagram 1
  }, 20_000);

  test("--json by number emits the structured payload", async () => {
    const { exitCode, stdout } = await runCli(["--json", "hexagram", "1"]);
    expect(exitCode).toBe(0);
    const hex = JSON.parse(stdout);
    expect(hex.number).toBe(1);
    expect(hex.name).toBe("乾");
    expect(typeof hex.pinyin).toBe("string");
    expect(hex.commentary).toBeTruthy();
  }, 20_000);

  test("by Chinese name resolves to the right hexagram", async () => {
    const { exitCode, stdout } = await runCli(["--json", "hexagram", "坤"]);
    expect(exitCode).toBe(0);
    // A name query may resolve to a unique hexagram or a shortlist; either way
    // it must surface hexagram 2 (坤). Handle both JSON shapes.
    const out = JSON.parse(stdout);
    const numbers = out.number != null ? [out.number] : out.matches.map((m: { number: number }) => m.number);
    expect(numbers).toContain(2);
  }, 20_000);

  test("an out-of-range number fails loudly with exit 1", async () => {
    const { exitCode, stdout, stderr } = await runCli(["hexagram", "99"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Hexagram number must be an integer from 1 to 64.");
    expect(stdout).toBe("");
  }, 20_000);

  test("a query that matches nothing fails with exit 1", async () => {
    const { exitCode, stderr } = await runCli(["hexagram", "zzzznotahexagram"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('No hexagram matches "zzzznotahexagram".');
  }, 20_000);

  test("an invalid --style fails with exit 1 and lists the valid styles", async () => {
    const { exitCode, stderr } = await runCli(["hexagram", "1", "--style", "bogus"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Invalid style "bogus"');
    expect(stderr).toContain("dx, tu, en, te, w");
  }, 20_000);
});
