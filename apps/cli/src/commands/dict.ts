// dict command — launch dictionary browse/detail scene

import { Command } from "commander";
import { resolveHexagramQuery } from "./hexagram.js";

export function registerDictCommand(program: Command): void {
  program
    .command("dict")
    .description("Browse the I Ching dictionary")
    .argument("[query]", "hexagram number (1-64), name, pinyin, or search query")
    .action(async (query?: string) => {
      const {
        BrowseScene,
        SceneRouter,
        TerminalSession,
        RealClock,
        detectColorSupport,
      } = await import("@iching/terminal");
      const { resolvePaths, JsonConfigStore, JsonlJournalStore } =
        await import("@iching/storage");
      const { makeBrowseFactory, makeDetailScene } =
        await import("../app/scene-factories.js");

      const globalOpts = program.opts();
      const paths = resolvePaths(
        globalOpts.dataDir ? { dataDir: globalOpts.dataDir } : undefined,
      );
      // Interactive entry point: seed + freeze the display language on first
      // boot (same as the main TUI), so `iching dict` honors the system locale
      // rather than launching English. (config subcommands stay pure load().)
      const config = await new JsonConfigStore(paths.config).loadOrSeed();
      const journal = new JsonlJournalStore(paths.state);
      const factoryDeps = { journal, language: config.language };

      // Determine initial scene. A number or unique name opens the detail
      // directly; anything else opens browse with the search prefilled (a
      // no-match query lands on the quiet empty hint, not an error).
      let initial;
      if (query) {
        const resolution = resolveHexagramQuery(query);
        if (resolution.kind === "invalid") {
          console.error("Hexagram number must be an integer from 1 to 64.");
          process.exit(1);
        }
        initial =
          resolution.kind === "kw"
            ? makeDetailScene(resolution.kw, factoryDeps)
            : new BrowseScene(query);
      } else {
        initial = new BrowseScene();
      }

      const session = new TerminalSession();
      const router = new SceneRouter(initial, makeBrowseFactory(factoryDeps));
      // Hold one alt-screen session across the router run — scene hops repaint
      // in place instead of flashing the user's shell (runScene is
      // ownership-aware and leaves an outer-held session alone).
      session.enter();
      try {
        // Thread config.language into the router so the BROWSE scene honors it
        // too (not just detail via factoryDeps) — P1-b fix.
        await router.run(session, new RealClock(), detectColorSupport(), false, config.language);
      } finally {
        session.exit();
      }
      process.exit(0);
    });
}
