#!/usr/bin/env bun
import { program } from "./program.js";
import { localToday } from "./util/today.js";

async function main() {
  // Operands are non-option args — i.e. actual subcommand names.
  // Global flags like --dev don't count as "args" for mode detection.
  const { operands } = program.parseOptions(process.argv.slice(2));
  const hasSubcommand = operands.length > 0;

  // Hook mode: no subcommand + stdin is piped (not a TTY) → Claude Code hook
  if (!hasSubcommand && !process.stdin.isTTY) {
    const { runHookAdapter } = await import("./hook/adapter.js");
    return runHookAdapter();
  }

  // Interactive mode: no subcommand + TTY → home menu
  if (!hasSubcommand && process.stdin.isTTY) {
    const { castHexagram, buildStructure, CryptoRandomSource, SeededRandomSource } = await import("@iching/core");
    const { resolvePaths, JsonDailyCacheStore, JsonlJournalStore, JsonConfigStore, getHexagramHistory } = await import("@iching/storage");
    const {
      HomeScene, CastScene, BrowseScene, DetailScene, JournalScene, SettingsScene,
      IntentionScene, TossScene,
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
    };
    let taijituStyle = savedConfig.taijituStyle as any;
    let castMode = (savedConfig.castMode ?? "auto") as "auto" | "manual";

    const session = new TerminalSession();
    const colorSupport = detectColorSupport();
    const clock = new RealClock();

    // Post-cast navigation (journal, dictionary, detail)
    async function handlePostCast(goto: string) {
      if (goto === "journal") {
        const journal = new JsonlJournalStore(paths.state);
        const entries: import("@iching/core").HistoryEntry[] = [];
        for await (const entry of journal.stream()) {
          entries.push(entry);
        }
        const journalScene = new JournalScene(entries);
        const factory = (id: string) => {
          if (id.startsWith("reading:")) {
            const key = id.slice(8);
            const entry = entries.find(e => e.timestamp === key || e.date === key);
            if (!entry) return new JournalScene(entries);
            const cs = new CastScene(entry.cast, "reduced", session.cols, glyphConfig, session.rows, entry.intention);
            cs.skipToComplete(false);
            return cs;
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
          if (id === "dictionary") return new BrowseScene();
          return new JournalScene(entries);
        };
        const router = new SceneRouter(journalScene, factory);
        await router.run(session, clock, colorSupport);
      } else if (goto === "dictionary" || goto.startsWith("detail:")) {
        const journal = new JsonlJournalStore(paths.state);
        const startScene = goto.startsWith("detail:")
          ? (() => {
              const kw = Number(goto.slice(7));
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

    // Home menu loop — keeps returning to home until exit
    let running = true;
    while (running) {
      const currentCache = await cacheStore.read();
      const homeScene = new HomeScene({
        todayCast: currentCache?.date === today ? currentCache : null,
        taijituStyle,
        devMode: !!opts.dev,
      });

      const signal = await runScene(homeScene, session, clock, colorSupport);

      if (signal === "exit" || !signal) {
        running = false;
        break;
      }

      if (typeof signal === "object" && "goto" in signal) {
        switch (signal.goto) {
          case "cast": {
            if (castMode === "manual") {
              const tossScene = new TossScene();
              const tossSignal = await runScene(tossScene, session, clock, colorSupport);
              if (tossSignal === "exit") running = false;
              break;
            }

            // Intention prompt (optional — Enter/Esc skips)
            const intentionScene = new IntentionScene();
            const intentionSignal = await runScene(intentionScene, session, clock, colorSupport);
            if (intentionSignal === "exit") break;

            const intention = intentionScene.getIntention();

            // Cast
            const seed = opts.seed ? Number(opts.seed) : undefined;
            const source = seed !== undefined
              ? new SeededRandomSource(seed)
              : new CryptoRandomSource();
            const preset = (savedConfig.motion ?? "default") as "default" | "brisk" | "deep" | "reduced";

            const cast = castHexagram(source);
            const structure = buildStructure(cast);
            const timestamp = new Date().toISOString();

            // Record to journal + cache
            if (seed === undefined) {
              const journal = new JsonlJournalStore(paths.state);
              await journal.append({ date: today, cast, intention, timestamp });
            }
            await cacheStore.write({ date: today, cast, shown: true, structure, intention });

            // Animated ritual
            const castScene = new CastScene(cast, preset, session.cols, glyphConfig, session.rows, intention);
            const castSignal = await runScene(castScene, session, clock, colorSupport);

            // Post-cast navigation
            if (typeof castSignal === "object" && castSignal !== null && "goto" in castSignal) {
              await handlePostCast(castSignal.goto);
            }
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
                const key = id.slice(8);
                const entry = entries.find(e => e.timestamp === key || e.date === key);
                if (!entry) return new JournalScene(entries);
                const castScene = new CastScene(entry.cast, "reduced", session.cols, glyphConfig, session.rows, entry.intention);
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
              if (id === "dictionary") return new BrowseScene();
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
              taijituStyle: config.taijituStyle as any,
              glyphAnim: config.glyphAnim,
              glyphFont: config.glyphFont,
              castMode: (config.castMode ?? "auto") as "auto" | "manual",
            });
            const settingsSignal = await runScene(settingsScene, session, clock, colorSupport);
            // Only save on escape (goto: "home"), not on Ctrl+C ("exit")
            if (settingsSignal !== "exit") {
              const updated = settingsScene.getValues();
              const newConfig = await configStore.load();
              newConfig.theme = updated.theme;
              newConfig.taijituStyle = updated.taijituStyle;
              newConfig.glyphAnim = updated.glyphAnim;
              newConfig.glyphFont = updated.glyphFont;
              newConfig.castMode = updated.castMode;
              await configStore.save(newConfig);
              setTheme(updated.theme);
              taijituStyle = updated.taijituStyle as any;
              castMode = updated.castMode;
              glyphConfig = {
                glyphAnim: updated.glyphAnim as any,
                glyphFont: updated.glyphFont as any,
              };
            } else {
              // Ctrl+C: revert theme to saved state
              setTheme(config.theme as any);
            }
            break;
          }

          case "play": {
            const tossScene = new TossScene();
            const tossSignal = await runScene(tossScene, session, clock, colorSupport);
            if (tossSignal === "exit") running = false;
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
