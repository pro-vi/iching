#!/usr/bin/env bun
import { program } from "./program.js";

async function main() {
  const hasArgs = process.argv.length > 2;

  // Hook mode: no args + stdin is piped (not a TTY) → Claude Code hook
  if (!hasArgs && !process.stdin.isTTY) {
    const { runHookAdapter } = await import("./hook/adapter.js");
    return runHookAdapter();
  }

  // Interactive mode: no args + TTY → animated casting ritual
  if (!hasArgs && process.stdin.isTTY) {
    const { castHexagram, buildStructure, CryptoRandomSource, SeededRandomSource } = await import("@iching/core");
    const { resolvePaths, JsonDailyCacheStore, JsonlJournalStore } = await import("@iching/storage");
    const { CastScene, TerminalSession, RealClock, runScene, detectColorSupport } = await import("@iching/terminal");

    const opts = program.opts();
    const seed = opts.seed ? Number(opts.seed) : undefined;
    const source = seed !== undefined ? new SeededRandomSource(seed) : new CryptoRandomSource();
    const preset = (opts.motion ?? "default") as "default" | "brisk" | "deep" | "reduced";

    const cast = castHexagram(source);
    const structure = buildStructure(cast);

    // Save to storage
    const paths = resolvePaths(opts.dataDir ? { dataDir: opts.dataDir } : undefined);
    const today = new Date().toISOString().slice(0, 10);
    const cacheStore = new JsonDailyCacheStore(paths.cache);
    await cacheStore.write({ date: today, cast, shown: true, structure });
    const journal = new JsonlJournalStore(paths.state);
    await journal.append({ date: today, cast });

    // Run animated ritual
    const session = new TerminalSession();
    const scene = new CastScene(cast, preset, session.cols);
    await runScene(scene, session, new RealClock(), detectColorSupport());
    process.exit(0);
  }

  // Command mode
  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
