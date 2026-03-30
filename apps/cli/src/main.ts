#!/usr/bin/env bun
import { program } from "./program.js";

async function main() {
  const hasArgs = process.argv.length > 2;

  // Hook mode: no args + stdin is piped (not a TTY) → Claude Code hook
  if (!hasArgs && !process.stdin.isTTY) {
    const { runHookAdapter } = await import("./hook/adapter.js");
    return runHookAdapter();
  }

  // Interactive mode: no args + TTY → placeholder for now
  if (!hasArgs && process.stdin.isTTY) {
    console.log("Interactive mode coming soon. Use 'iching cast' for now.");
    process.exit(0);
  }

  // Command mode
  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
