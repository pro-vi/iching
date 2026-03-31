// dict command — launch dictionary browse/detail scene

import { Command } from "commander";

export function registerDictCommand(program: Command): void {
  program
    .command("dict")
    .description("Browse the I Ching dictionary")
    .argument("[n]", "hexagram number (1-64) to view directly")
    .action(async (n?: string) => {
      const {
        BrowseScene,
        DetailScene,
        SceneRouter,
        TerminalSession,
        RealClock,
        detectColorSupport,
      } = await import("@iching/terminal");
      const { resolvePaths, JsonlJournalStore, getHexagramHistory } =
        await import("@iching/storage");

      const globalOpts = program.opts();
      const paths = resolvePaths(
        globalOpts.dataDir ? { dataDir: globalOpts.dataDir } : undefined,
      );
      const journal = new JsonlJournalStore(paths.state);

      // Scene factory for router
      const factory = (id: string) => {
        if (id.startsWith("detail:")) {
          const kw = Number(id.slice(7));
          return new DetailScene(kw);
        }
        return new BrowseScene();
      };

      // Determine initial scene
      let initial;
      if (n) {
        const num = Number(n);
        if (!Number.isInteger(num) || num < 1 || num > 64) {
          console.error("Hexagram number must be an integer from 1 to 64.");
          process.exit(1);
        }
        const scene = new DetailScene(num);
        // Load history for this hexagram
        const history = await getHexagramHistory(journal, num);
        scene.setHistory(history.castCount, history.lastCastDate);
        initial = scene;
      } else {
        initial = new BrowseScene();
      }

      const session = new TerminalSession();
      const router = new SceneRouter(initial, factory);
      await router.run(session, new RealClock(), detectColorSupport());
      process.exit(0);
    });
}
