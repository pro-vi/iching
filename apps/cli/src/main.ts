#!/usr/bin/env bun
import { program } from "./program.js";
import { localToday } from "./util/today.js";

async function main() {
  // Operands are non-option args — i.e. actual subcommand names.
  // Global flags like --dev don't count as "args" for mode detection.
  const { operands, unknown } = program.parseOptions(process.argv.slice(2));
  const hasSubcommand = operands.length > 0;

  // Unknown top-level flags (--help, --bogus, etc.) must reach Commander so
  // it can print help or surface a "unknown option" error. Without this
  // guard, `iching --help` falls through into hook/TUI mode and produces
  // no help text.
  if (unknown.length > 0) {
    await program.parseAsync(process.argv);
    return;
  }

  // Hook mode: no subcommand + stdin is piped (not a TTY) → Claude Code hook
  if (!hasSubcommand && !process.stdin.isTTY) {
    const { runHookAdapter } = await import("./hook/adapter.js");
    return runHookAdapter();
  }

  // Interactive mode: no subcommand + TTY → home menu
  if (!hasSubcommand && process.stdin.isTTY) {
    const { resolvePaths, JsonDailyCacheStore, JsonlJournalStore, JsonConfigStore } = await import("@iching/storage");
    const {
      HomeScene, BrowseScene, JournalScene, SettingsScene,
      SceneRouter, TerminalSession, RealClock, runScene, detectColorSupport,
      setTheme,
    } = await import("@iching/terminal");
    const { runReadingFlow } = await import("./app/reading-flow.js");
    const { makeBrowseFactory, makeJournalFactory, loadJournalEntries } = await import("./app/scene-factories.js");

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
    let castMethod = savedConfig.castMethod ?? "coin";
    let castMode = savedConfig.castMode ?? "auto";

    const session = new TerminalSession();
    const colorSupport = detectColorSupport();
    const clock = new RealClock();

    // Bound runners — every call site uses the same session/clock/color/dev
    const run = (scene: Parameters<typeof runScene>[0]) =>
      runScene(scene, session, clock, colorSupport, devMode);
    const runRouter = (router: InstanceType<typeof SceneRouter>) =>
      router.run(session, clock, colorSupport, devMode);

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

      if (!signal || signal.type === "exit") {
        running = false;
        break;
      }

      // Build per-iteration deps so any settings updates from prior iterations are picked up.
      const flowDeps = {
        run, runRouter,
        paths, cacheStore, today,
        session: { cols: session.cols, rows: session.rows },
        glyphConfig,
        motion: savedConfig.motion ?? "default",
      };

      // Derive the reading source from the (castMethod, castMode) pair.
      // Cast and Play share this — Play is "sandbox-Cast" minus persistence.
      const castSource = (): Parameters<typeof runReadingFlow>[1]["source"] => {
        if (castMethod === "yarrow") {
          return castMode === "manual" ? { type: "yarrow-manual" } : { type: "yarrow" };
        }
        return castMode === "manual"
          ? { type: "manual" }
          : { type: "auto", seed: opts.seed ? Number(opts.seed) : undefined };
      };

      switch (signal.type) {
        case "startPlay": {
          const result = await runReadingFlow(flowDeps, {
            purpose: "play",
            source: castSource(),
          });
          if (result.shouldExit) running = false;
          break;
        }

        case "startCast": {
          const result = await runReadingFlow(flowDeps, {
            purpose: "cast",
            source: castSource(),
          });
          if (result.shouldExit) running = false;
          break;
        }

        case "openDictionary": {
          const journal = new JsonlJournalStore(paths.state);
          const router = new SceneRouter(
            new BrowseScene(),
            makeBrowseFactory({ glyphConfig, journal }),
          );
          const result = await runRouter(router);
          if (result.shouldExit) running = false;
          break;
        }

        case "openJournal": {
          const journal = new JsonlJournalStore(paths.state);
          const entries = await loadJournalEntries(journal);
          const router = new SceneRouter(
            new JournalScene(entries),
            makeJournalFactory({
              glyphConfig,
              journal,
              entries,
              session: { cols: session.cols, rows: session.rows },
            }),
          );
          const result = await runRouter(router);
          if (result.shouldExit) running = false;
          break;
        }

        case "openSettings": {
          const config = await configStore.load();
          const settingsScene = new SettingsScene({
            theme: config.theme,
            language: config.language,
            taijituStyle: config.taijituStyle,
            glyphAnim: config.glyphAnim,
            glyphFont: config.glyphFont,
            castMethod: config.castMethod ?? "coin",
            castMode: config.castMode ?? "auto",
          });
          const settingsSignal = await run(settingsScene);
          // Save on escape (signal "home"); revert on Ctrl+C ("exit")
          if (settingsSignal?.type === "home") {
            const updated = settingsScene.getValues();
            const newConfig = await configStore.load();
            newConfig.theme = updated.theme;
            newConfig.language = updated.language;
            newConfig.taijituStyle = updated.taijituStyle;
            newConfig.glyphAnim = updated.glyphAnim;
            newConfig.glyphFont = updated.glyphFont;
            newConfig.castMethod = updated.castMethod;
            newConfig.castMode = updated.castMode;
            await configStore.save(newConfig);
            setTheme(updated.theme);
            taijituStyle = updated.taijituStyle;
            castMethod = updated.castMethod;
            castMode = updated.castMode;
            glyphConfig = {
              glyphAnim: updated.glyphAnim,
              glyphFont: updated.glyphFont,
            };
          } else if (settingsSignal?.type === "exit") {
            // Ctrl+C: revert theme to saved state and exit
            setTheme(config.theme);
            running = false;
          }
          break;
        }

        default:
          break;
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
