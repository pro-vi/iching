// Subprocess coverage for the `hexagram` command — number/name lookup, --json,
// --style, and the error/exit-code paths. The resolver (resolveHexagramQuery)
// and the formatter are unit-tested elsewhere; this pins the command WIRING:
// arg parsing, the global --json flag, and the exact exit codes.
import { describe, test, expect } from "bun:test";
import { runCli } from "../testing.ts";

describe("hexagram command", () => {
  test("by King Wen number prints the hexagram", async () => {
    const { exitCode, stdout } = await runCli(["hexagram", "1"], { env: { TZ: "UTC" } });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("乾"); // hexagram 1
  }, 20_000);

  test("--json by number emits the structured payload", async () => {
    const { exitCode, stdout } = await runCli(["--json", "hexagram", "1"], { env: { TZ: "UTC" } });
    expect(exitCode).toBe(0);
    const hex = JSON.parse(stdout);
    expect(hex.number).toBe(1);
    expect(hex.name).toBe("乾");
    expect(typeof hex.pinyin).toBe("string");
    expect(hex.commentary).toBeTruthy();
  }, 20_000);

  test("by Chinese name resolves to the right hexagram", async () => {
    const { exitCode, stdout } = await runCli(["--json", "hexagram", "坤"], { env: { TZ: "UTC" } });
    expect(exitCode).toBe(0);
    // A name query may resolve to a unique hexagram or a shortlist; either way
    // it must surface hexagram 2 (坤). Handle both JSON shapes.
    const out = JSON.parse(stdout);
    const numbers = out.number != null ? [out.number] : out.matches.map((m: { number: number }) => m.number);
    expect(numbers).toContain(2);
  }, 20_000);

  test("an out-of-range number fails loudly with exit 1", async () => {
    const { exitCode, stdout, stderr } = await runCli(["hexagram", "99"], { env: { TZ: "UTC" } });
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Hexagram number must be an integer from 1 to 64.");
    expect(stdout).toBe("");
  }, 20_000);

  test("a query that matches nothing fails with exit 1", async () => {
    const { exitCode, stderr } = await runCli(["hexagram", "zzzznotahexagram"], { env: { TZ: "UTC" } });
    expect(exitCode).toBe(1);
    expect(stderr).toContain('No hexagram matches "zzzznotahexagram".');
  }, 20_000);

  test("an invalid --style fails with exit 1 and lists the valid styles", async () => {
    const { exitCode, stderr } = await runCli(["hexagram", "1", "--style", "bogus"], { env: { TZ: "UTC" } });
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Invalid style "bogus"');
    expect(stderr).toContain("dx, tu, en, te, w");
  }, 20_000);
});
