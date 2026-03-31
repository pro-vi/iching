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
    const signal = await runScene(scene, session, new RealClock(), detectColorSupport());

    // Handle post-ritual action
    if (typeof signal === "object" && signal !== null && "goto" in signal) {
      const { formatCastPlain } = await import("./output/plain.js");
      const { GUA } = await import("@iching/core");
      const primary = GUA[cast.primary - 1];

      if (signal.goto === "reading") {
        console.log(formatCastPlain(cast, primary, structure));
      } else if (signal.goto === "journal") {
        const journalStore = new JsonlJournalStore(paths.state);
        const latest = await journalStore.latest();
        if (latest) {
          const g = GUA[latest.cast.primary - 1];
          const s = buildStructure(latest.cast);
          console.log(`Latest reading (${latest.date}):\n`);
          console.log(formatCastPlain(latest.cast, g, s));
        } else {
          console.log("No journal entries found.");
        }
      } else if (signal.goto === "dictionary") {
        const { BrowseScene, DetailScene, SceneRouter } = await import("@iching/terminal");
        const browseScene = new BrowseScene();
        const factory = (id: string) => {
          if (id.startsWith("detail:")) {
            return new DetailScene(Number(id.slice(7)));
          }
          return new BrowseScene();
        };
        const router = new SceneRouter(browseScene, factory);
        await router.run(session, new RealClock(), detectColorSupport());
      }
    }
    process.exit(0);
  }

  // Command mode
  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
