#!/usr/bin/env bun
/**
 * Smoke test a compiled binary.
 * Usage: bun scripts/smoke-test.ts [path-to-binary]
 * Without an argument, defaults to the current platform's build artifact
 * (dist/iching-<platform>-<arch>, the path scripts/build.ts writes), so a
 * bare `bun run smoke` works after `bun run build`.
 */
import { $ } from "bun";
import { existsSync } from "node:fs";
import { join } from "node:path";

function defaultBinary(): string {
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  const platform = process.platform === "darwin" ? "darwin" : "linux";
  return join("dist", `iching-${platform}-${arch}`);
}

const binary = process.argv[2] ?? defaultBinary();

if (!existsSync(binary)) {
  console.error(`Binary not found: ${binary}`);
  console.error(
    process.argv[2]
      ? "Check the path, or build it with: bun run build"
      : "Build it first with: bun run build (or pass an explicit path: bun scripts/smoke-test.ts <path-to-binary>)",
  );
  process.exit(1);
}

let passed = 0;
let failed = 0;

async function test(
  name: string,
  fn: () => Promise<void>,
): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  FAIL  ${name}: ${msg}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

console.log(`Smoke testing: ${binary}\n`);

// 1. --version outputs version string
await test("--version outputs version string", async () => {
  const result = await $`${binary} --version`.quiet().nothrow();
  const output = result.stdout.toString().trim();
  assert(result.exitCode === 0, `exit code ${result.exitCode}`);
  assert(output.length > 0, "no version output");
  assert(/\d+\.\d+\.\d+/.test(output), `unexpected version format: "${output}"`);
});

// 2. cast --seed 42 produces deterministic output
await test("cast --seed 42 produces deterministic output", async () => {
  const r1 = await $`${binary} cast --seed 42`.quiet().nothrow();
  const r2 = await $`${binary} cast --seed 42`.quiet().nothrow();
  assert(r1.exitCode === 0, `exit code ${r1.exitCode}`);
  assert(r2.exitCode === 0, `exit code ${r2.exitCode}`);
  const o1 = r1.stdout.toString().trim();
  const o2 = r2.stdout.toString().trim();
  assert(o1.length > 0, "no output from cast");
  assert(o1 === o2, "cast --seed 42 produced different output on two runs");
});

// 3. cast --seed 42 --json produces valid JSON
await test("cast --seed 42 --json produces valid JSON", async () => {
  const result = await $`${binary} cast --seed 42 --json`.quiet().nothrow();
  assert(result.exitCode === 0, `exit code ${result.exitCode}`);
  const output = result.stdout.toString().trim();
  const data = JSON.parse(output);
  assert(typeof data === "object" && data !== null, "JSON is not an object");
  assert("primary" in data, "JSON missing 'primary' field");
});

// 4. hexagram 1 produces output containing "乾"
await test('hexagram 1 contains "乾"', async () => {
  const result = await $`${binary} hexagram 1`.quiet().nothrow();
  assert(result.exitCode === 0, `exit code ${result.exitCode}`);
  const output = result.stdout.toString();
  assert(output.includes("乾"), `output does not contain "乾": ${output.slice(0, 200)}`);
});

// 5. doctor runs without error exit code
await test("doctor runs without error", async () => {
  const result = await $`${binary} doctor`.quiet().nothrow();
  assert(result.exitCode === 0, `exit code ${result.exitCode}`);
  const output = result.stdout.toString();
  assert(output.includes("Doctor"), `unexpected doctor output: ${output.slice(0, 200)}`);
});

// Summary
console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total`);

if (failed > 0) {
  process.exit(1);
}
