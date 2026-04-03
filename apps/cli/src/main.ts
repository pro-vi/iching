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
    const { castHexagram, buildStructure, CryptoRandomSource, SeededRandomSource } = await import("@iching/core");
    const { resolvePaths, JsonDailyCacheStore, JsonlJournalStore, JsonConfigStore, getHexagramHistory } = await import("@iching/storage");
    const {
      HomeScene, CastScene, BrowseScene, DetailScene, JournalScene, SettingsScene,
      SceneRouter, TerminalSession, RealClock, runScene, detectColorSupport,
      setTheme,
    } = await import("@iching/terminal");

    const opts = program.opts();
    const paths = resolvePaths(opts.dataDir ? { dataDir: opts.dataDir } : undefined);
    const cacheStore = new JsonDailyCacheStore(paths.cache);
    const today = localToday();

    // Load and apply saved theme
    const configStore = new JsonConfigStore(paths.config);
    const savedConfig = await configStore.load();
    setTheme(savedConfig.theme as any);
    let glyphConfig = {
      glyphAnim: savedConfig.glyphAnim as any,
      glyphFont: savedConfig.glyphFont as any,
      glyphSize: savedConfig.glyphSize as any,
    };
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
              // Show today's existing reading — fully revealed, interactive
              const castScene = new CastScene(existing.cast, "reduced", session.cols, glyphConfig, session.rows);
              castScene.skipToComplete();
              const castSignal = await runScene(castScene, session, clock, colorSupport);

              if (typeof castSignal === "object" && castSignal !== null && "goto" in castSignal) {
                if (castSignal.goto === "journal") {
                  const journal = new JsonlJournalStore(paths.state);
                  const entries: import("@iching/core").HistoryEntry[] = [];
                  for await (const entry of journal.stream()) {
                    entries.push(entry);
                  }
                  const journalScene = new JournalScene(entries);
                  const factory = (id: string) => {
                    if (id.startsWith("reading:")) {
                      const date = id.slice(8);
                      const entry = entries.find(e => e.date === date);
                      if (!entry) return new JournalScene(entries);
                      const castScene2 = new CastScene(entry.cast, "reduced", session.cols, glyphConfig, session.rows);
                      castScene2.skipToComplete(false);
                      return castScene2;
                    }
                    if (id.startsWith("detail:")) {
                      const kw = Number(id.slice(7));
                      if (!Number.isInteger(kw) || kw < 1 || kw > 64) return new JournalScene(entries);
                      const scene = new DetailScene(kw, glyphConfig);
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
                } else if (castSignal.goto === "dictionary" || castSignal.goto.startsWith("detail:")) {
                  const journal = new JsonlJournalStore(paths.state);
                  const startScene = castSignal.goto.startsWith("detail:")
                    ? (() => {
                        const kw = Number(castSignal.goto.slice(7));
                        if (!Number.isInteger(kw) || kw < 1 || kw > 64) return new BrowseScene();
                        const scene = new DetailScene(kw, glyphConfig);
                        getHexagramHistory(journal, kw).then((h) =>
                          scene.setHistory(h.castCount, h.lastCastDate),
                        );
                        return scene;
                      })()
                    : new BrowseScene();
                  const factory = (id: string) => {
                    if (id.startsWith("detail:")) {
                      const kw = Number(id.slice(7));
                      if (!Number.isInteger(kw) || kw < 1 || kw > 64) return new BrowseScene();
                      const scene = new DetailScene(kw, glyphConfig);
                      getHexagramHistory(journal, kw).then((h) =>
                        scene.setHistory(h.castCount, h.lastCastDate),
                      );
                      return scene;
                    }
                    return new BrowseScene();
                  };
                  const router = new SceneRouter(startScene, factory);
                  await router.run(session, clock, colorSupport);
                }
              }
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
              const castScene = new CastScene(cast, preset, session.cols, glyphConfig, session.rows);
              const castSignal = await runScene(castScene, session, clock, colorSupport);

              // Handle post-cast action
              if (typeof castSignal === "object" && castSignal !== null && "goto" in castSignal) {
                if (castSignal.goto === "journal") {
                  const journal = new JsonlJournalStore(paths.state);
                  const entries: import("@iching/core").HistoryEntry[] = [];
                  for await (const entry of journal.stream()) {
                    entries.push(entry);
                  }
                  const journalScene = new JournalScene(entries);
                  const factory = (id: string) => {
                    if (id.startsWith("reading:")) {
                      const date = id.slice(8);
                      const entry = entries.find(e => e.date === date);
                      if (!entry) return new JournalScene(entries);
                      const castScene2 = new CastScene(entry.cast, "reduced", session.cols, glyphConfig, session.rows);
                      castScene2.skipToComplete(false);
                      return castScene2;
                    }
                    if (id.startsWith("detail:")) {
                      const kw = Number(id.slice(7));
                      if (!Number.isInteger(kw) || kw < 1 || kw > 64) return new JournalScene(entries);
                      const scene = new DetailScene(kw, glyphConfig);
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
                } else if (castSignal.goto === "dictionary" || castSignal.goto.startsWith("detail:")) {
                  const journal = new JsonlJournalStore(paths.state);
                  const startScene = castSignal.goto.startsWith("detail:")
                    ? (() => {
                        const kw = Number(castSignal.goto.slice(7));
                        if (!Number.isInteger(kw) || kw < 1 || kw > 64) return new BrowseScene();
                        const scene = new DetailScene(kw, glyphConfig);
                        getHexagramHistory(journal, kw).then((h) =>
                          scene.setHistory(h.castCount, h.lastCastDate),
                        );
                        return scene;
                      })()
                    : new BrowseScene();
                  const factory = (id: string) => {
                    if (id.startsWith("detail:")) {
                      const kw = Number(id.slice(7));
                      if (!Number.isInteger(kw) || kw < 1 || kw > 64) return new BrowseScene();
                      const scene = new DetailScene(kw, glyphConfig);
                      getHexagramHistory(journal, kw).then((h) =>
                        scene.setHistory(h.castCount, h.lastCastDate),
                      );
                      return scene;
                    }
                    return new BrowseScene();
                  };
                  const router = new SceneRouter(startScene, factory);
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
                const scene = new DetailScene(kw, glyphConfig);
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
              if (id.startsWith("reading:")) {
                // Open cast exploration view for a journal entry by date
                const date = id.slice(8);
                const entry = entries.find(e => e.date === date);
                if (!entry) return new JournalScene(entries);
                const castScene = new CastScene(entry.cast, "reduced", session.cols, glyphConfig, session.rows);
                castScene.skipToComplete(false);
                return castScene;
              }
              if (id.startsWith("detail:")) {
                const kw = Number(id.slice(7));
                if (!Number.isInteger(kw) || kw < 1 || kw > 64) return new JournalScene(entries);
                const scene = new DetailScene(kw, glyphConfig);
                getHexagramHistory(journal, kw).then((h) =>
                  scene.setHistory(h.castCount, h.lastCastDate),
                );
                return scene;
              }
              if (id === "dictionary") {
                return new BrowseScene();
              }
              if (id === "journal") {
                return new JournalScene(entries);
              }
              return new JournalScene(entries);
            };
            const router = new SceneRouter(journalScene, factory);
            await router.run(session, clock, colorSupport);
            break;
          }

          case "settings": {
            const config = await configStore.load();
            const settingsScene = new SettingsScene({
              theme: config.theme as any,
              glyphAnim: config.glyphAnim,
              glyphFont: config.glyphFont,
              glyphSize: config.glyphSize,
            });
            const settingsSignal = await runScene(settingsScene, session, clock, colorSupport);
            // Only save on escape (goto: "home"), not on Ctrl+C ("exit")
            if (settingsSignal !== "exit") {
              const updated = settingsScene.getValues();
              const newConfig = await configStore.load();
              newConfig.theme = updated.theme;
              newConfig.glyphAnim = updated.glyphAnim;
              newConfig.glyphFont = updated.glyphFont;
              newConfig.glyphSize = updated.glyphSize;
              await configStore.save(newConfig);
              setTheme(updated.theme);
              glyphConfig = {
                glyphAnim: updated.glyphAnim as any,
                glyphFont: updated.glyphFont as any,
                glyphSize: updated.glyphSize as any,
              };
            } else {
              // Ctrl+C: revert theme to saved state
              setTheme(config.theme as any);
            }
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
