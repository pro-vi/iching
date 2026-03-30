#!/usr/bin/env bun
/**
 * Cross-platform build script for iching CLI.
 * Usage: bun scripts/build.ts [--all] [--target <target>]
 * Without flags, builds for current platform only.
 * --all builds for all supported targets.
 */
import { $ } from "bun";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const TARGETS = [
  "bun-darwin-arm64",
  "bun-darwin-x64",
  "bun-linux-x64",
  "bun-linux-arm64",
] as const;

type Target = (typeof TARGETS)[number];

const ENTRY = "apps/cli/src/main.ts";
const DIST = "dist";

function currentTarget(): Target {
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  const platform = process.platform === "darwin" ? "darwin" : "linux";
  return `bun-${platform}-${arch}` as Target;
}

function artifactName(target: Target): string {
  return `iching-${target.replace("bun-", "")}`;
}

async function build(target: Target): Promise<void> {
  const outfile = join(DIST, artifactName(target));
  console.log(`Building ${target} -> ${outfile}`);

  const result =
    await $`bun build --compile --target=${target} ${ENTRY} --outfile ${outfile}`.nothrow();

  if (result.exitCode !== 0) {
    console.error(`Failed to build ${target}`);
    process.exit(1);
  }

  console.log(`  Done: ${outfile}`);
}

async function main() {
  const args = process.argv.slice(2);
  await mkdir(DIST, { recursive: true });

  let targets: Target[];

  if (args.includes("--all")) {
    targets = [...TARGETS];
  } else {
    const targetIdx = args.indexOf("--target");
    if (targetIdx !== -1 && args[targetIdx + 1]) {
      const t = args[targetIdx + 1] as Target;
      if (!TARGETS.includes(t)) {
        console.error(`Unknown target: ${t}`);
        console.error(`Valid targets: ${TARGETS.join(", ")}`);
        process.exit(1);
      }
      targets = [t];
    } else {
      targets = [currentTarget()];
    }
  }

  console.log(`Building ${targets.length} target(s)...\n`);

  for (const target of targets) {
    await build(target);
  }

  console.log("\nBuild complete.");
}

main();
