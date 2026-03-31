#!/usr/bin/env bun
import { program } from "./program.js";
import { localToday } from "./util/today.js";

async function main() {
  const hasArgs = process.argv.length > 2;

  // Hook mode: no args + stdin is piped (not a TTY) → Claude Code hook
  if (!hasArgs && !process.stdin.isTTY) {
    const { runHookAdapter } = await import("./hook/adapter.js");
    return runHookAdapter();
  }

  // Interactive mode: no args + TTY → home menu
  if (!hasArgs && process.stdin.isTTY) {
    const { castHexagram, buildStructure, CryptoRandomSource, SeededRandomSource, GUA } = await import("@iching/core");
    const { resolvePaths, JsonDailyCacheStore, JsonlJournalStore, getHexagramHistory } = await import("@iching/storage");
    const {
      HomeScene, CastScene, BrowseScene, DetailScene, JournalScene,
      SceneRouter, TerminalSession, RealClock, runScene, detectColorSupport,
    } = await import("@iching/terminal");
    const { formatCastPlain } = await import("./output/plain.js");

    const opts = program.opts();
    const paths = resolvePaths(opts.dataDir ? { dataDir: opts.dataDir } : undefined);
    const cacheStore = new JsonDailyCacheStore(paths.cache);
    const today = localToday();
    const todayCast = await cacheStore.read();
    const hasTodayCast = todayCast?.date === today;

    const session = new TerminalSession();
    const colorSupport = detectColorSupport();
    const clock = new RealClock();

    // Home menu loop — keeps returning to home until exit
    let running = true;
    while (running) {
      const currentCache = await cacheStore.read();
      const homeScene = new HomeScene({
        todayCast: currentCache?.date === today ? currentCache : null,
      });

      const signal = await runScene(homeScene, session, clock, colorSupport);

      if (signal === "exit" || !signal) {
        running = false;
        break;
      }

      if (typeof signal === "object" && "goto" in signal) {
        switch (signal.goto) {
          case "cast": {
            // Check if already cast today
            const existing = await cacheStore.read();
            const alreadyCastToday = existing?.date === today;

            if (alreadyCastToday) {
              // Show today's existing reading — no new cast
              const primary = GUA[existing.cast.primary - 1];
              const structure = buildStructure(existing.cast);
              console.log("Today's reading:\n");
              console.log(formatCastPlain(existing.cast, primary, structure));
              console.log("\nPress any key to return to menu...");
              await new Promise<void>(resolve => {
                process.stdin.setRawMode(true);
                process.stdin.once("data", () => {
                  process.stdin.setRawMode(false);
                  resolve();
                });
              });
            } else {
              // First cast of the day — animated ritual
              const seed = opts.seed ? Number(opts.seed) : undefined;
              const source = seed !== undefined
                ? new SeededRandomSource(seed)
                : new CryptoRandomSource();
              const preset = (opts.motion ?? "default") as "default" | "brisk" | "deep" | "reduced";

              const cast = castHexagram(source);
              const structure = buildStructure(cast);

              // Record to journal
              if (seed === undefined) {
                const journal = new JsonlJournalStore(paths.state);
                await journal.append({ date: today, cast });
              }
              await cacheStore.write({ date: today, cast, shown: true, structure });

              // Run animated ritual
              const castScene = new CastScene(cast, preset, session.cols);
              const castSignal = await runScene(castScene, session, clock, colorSupport);

              // Handle post-cast action
              if (typeof castSignal === "object" && castSignal !== null && "goto" in castSignal) {
                if (castSignal.goto === "reading") {
                  const primary = GUA[cast.primary - 1];
                  console.log(formatCastPlain(cast, primary, structure));
                  console.log("\nPress any key to return to menu...");
                  await new Promise<void>(resolve => {
                    process.stdin.setRawMode(true);
                    process.stdin.once("data", () => {
                      process.stdin.setRawMode(false);
                      resolve();
                    });
                  });
                } else if (castSignal.goto === "dictionary") {
                  const journal = new JsonlJournalStore(paths.state);
                  const browseScene = new BrowseScene();
                  const factory = (id: string) => {
                    if (id.startsWith("detail:")) {
                      const kw = Number(id.slice(7));
                      if (!Number.isInteger(kw) || kw < 1 || kw > 64) return new BrowseScene();
                      const scene = new DetailScene(kw);
                      getHexagramHistory(journal, kw).then((h) =>
                        scene.setHistory(h.castCount, h.lastCastDate),
                      );
                      return scene;
                    }
                    return new BrowseScene();
                  };
                  const router = new SceneRouter(browseScene, factory);
                  await router.run(session, clock, colorSupport);
                }
              }
            }
            // Return to home menu
            break;
          }

          case "dictionary": {
            const journal = new JsonlJournalStore(paths.state);
            const browseScene = new BrowseScene();
            const factory = (id: string) => {
              if (id.startsWith("detail:")) {
                const kw = Number(id.slice(7));
                if (!Number.isInteger(kw) || kw < 1 || kw > 64) return new BrowseScene();
                const scene = new DetailScene(kw);
                getHexagramHistory(journal, kw).then((h) =>
                  scene.setHistory(h.castCount, h.lastCastDate),
                );
                return scene;
              }
              return new BrowseScene();
            };
            const router = new SceneRouter(browseScene, factory);
            await router.run(session, clock, colorSupport);
            break;
          }

          case "journal": {
            const journal = new JsonlJournalStore(paths.state);
            const entries: import("@iching/core").HistoryEntry[] = [];
            for await (const entry of journal.stream()) {
              entries.push(entry);
            }
            const journalScene = new JournalScene(entries);
            const factory = (id: string) => {
              if (id.startsWith("detail:")) {
                const kw = Number(id.slice(7));
                if (!Number.isInteger(kw) || kw < 1 || kw > 64) return new JournalScene(entries);
                const scene = new DetailScene(kw);
                getHexagramHistory(journal, kw).then((h) =>
                  scene.setHistory(h.castCount, h.lastCastDate),
                );
                return scene;
              }
              if (id === "dictionary") {
                return new BrowseScene();
              }
              return new JournalScene(entries);
            };
            const router = new SceneRouter(journalScene, factory);
            await router.run(session, clock, colorSupport);
            break;
          }

          default:
            break;
        }
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
