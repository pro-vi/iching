#!/usr/bin/env bun
import { program } from "./program.js";
import { localToday } from "./util/today.js";
import type { Cast } from "@iching/core";

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
    const devMode = !!opts.dev;
    const paths = resolvePaths(opts.dataDir ? { dataDir: opts.dataDir } : undefined);
    const cacheStore = new JsonDailyCacheStore(paths.cache);
    const today = localToday();

    // Load and apply saved theme
    const configStore = new JsonConfigStore(paths.config);
    const savedConfig = await configStore.load();
    setTheme(savedConfig.theme);
    let glyphConfig = {
      glyphAnim: savedConfig.glyphAnim,
      glyphFont: savedConfig.glyphFont,
    };
    let taijituStyle = savedConfig.taijituStyle;
    let castMode = savedConfig.castMode ?? "auto";

    const session = new TerminalSession();
    const colorSupport = detectColorSupport();
    const clock = new RealClock();

    // Bound runners — every call site uses the same session/clock/color/dev
    const run = (scene: Parameters<typeof runScene>[0]) =>
      runScene(scene, session, clock, colorSupport, devMode);
    const runRouter = (router: InstanceType<typeof SceneRouter>) =>
      router.run(session, clock, colorSupport, devMode);

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
        await runRouter(router);
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
        await runRouter(router);
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

      const signal = await run(homeScene);

      if (signal === "exit" || !signal) {
        running = false;
        break;
      }

      if (typeof signal === "object" && "goto" in signal) {
        switch (signal.goto) {
          case "play":
          case "cast": {
            const isPlay = signal.goto === "play";
            // Play is always the coin-toss sandbox; Cast respects the saved mode.
            const useManual = isPlay || castMode === "manual";

            // 1. Ask — intention prompt, shared by both paths, skipped only for Play
            let intention: string | undefined;
            if (!isPlay) {
              const intentionScene = new IntentionScene();
              const intentionSignal = await run(intentionScene);
              if (intentionSignal === "exit") break;
              intention = intentionScene.getIntention();
            }

            // 2. Obtain the cast (manual: physics toss; auto: algorithmic)
            let cast: Cast;
            let usedSeed = false;

            if (useManual) {
              const tossScene = new TossScene();
              const tossSignal = await run(tossScene);
              if (tossSignal === "exit") { running = false; break; }
              const tossed = tossScene.getCast();
              const completed = tossed && typeof tossSignal === "object"
                && tossSignal !== null && "goto" in tossSignal
                && tossSignal.goto === "cast-reveal";
              if (!completed) break; // user quit before completing 6 lines
              cast = tossed!;
            } else {
              const seed = opts.seed ? Number(opts.seed) : undefined;
              usedSeed = seed !== undefined;
              const source = usedSeed
                ? new SeededRandomSource(seed!)
                : new CryptoRandomSource();
              cast = castHexagram(source);
            }

            // 3. Persist (skipped for play; seeded auto casts skip the journal but still update the cache)
            if (!isPlay) {
              const structure = buildStructure(cast);
              const timestamp = new Date().toISOString();
              if (!usedSeed) {
                const journal = new JsonlJournalStore(paths.state);
                await journal.append({ date: today, cast, intention, timestamp });
              }
              await cacheStore.write({ date: today, cast, shown: true, structure, intention });
            }

            // 4. Reveal (manual path skips the line-drawing timeline since coins already cast the lines)
            const preset = (savedConfig.motion ?? "default") as "default" | "brisk" | "deep" | "reduced";
            const castScene = new CastScene(cast, preset, session.cols, glyphConfig, session.rows, intention);
            if (useManual) castScene.skipToComplete(true);
            const castSignal = await run(castScene);

            // 5. Post-cast navigation (skipped for play)
            if (!isPlay && typeof castSignal === "object" && castSignal !== null && "goto" in castSignal) {
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
            await runRouter(router);
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
            await runRouter(router);
            break;
          }

          case "settings": {
            const config = await configStore.load();
            const settingsScene = new SettingsScene({
              theme: config.theme,
              taijituStyle: config.taijituStyle,
              glyphAnim: config.glyphAnim,
              glyphFont: config.glyphFont,
              castMode: config.castMode ?? "auto",
            });
            const settingsSignal = await run(settingsScene);
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
              taijituStyle = updated.taijituStyle;
              castMode = updated.castMode;
              glyphConfig = {
                glyphAnim: updated.glyphAnim,
                glyphFont: updated.glyphFont,
              };
            } else {
              // Ctrl+C: revert theme to saved state
              setTheme(config.theme);
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
