import { Command } from "commander";
import { resolvePaths, JsonDailyCacheStore, JsonlJournalStore, JsonConfigStore } from "@iching/storage";
import { formatTodayPlain } from "../output/plain.js";
import { outputJson, todayToJson, noTodayToJson } from "../output/json.js";
import { localToday } from "../util/today.js";
import { resolveTodayReading } from "../util/today-cache.js";

export function registerTodayCommand(program: Command): void {
  program
    .command("today")
    .description("Show today's reading (cast in the TUI)")
    .action(async () => {
      const opts = program.opts();
      const paths = resolvePaths(
        opts.dataDir ? { dataDir: opts.dataDir } : undefined,
      );

      // Quiet for the same per-prompt reason as the cache read below: `today`
      // can run from a shell greeting on every prompt, so a corrupt/unreadable
      // config must fall back to defaults silently, not warn each time.
      const config = await new JsonConfigStore(paths.config, { quiet: true }).load();
      const today = localToday(config.timezone);
      // Cache-first, journal-fallback via the shared durable-recovery resolver,
      // so `today` agrees with the TUI [t] reopen and the hook on what today's
      // reading is — even when the cache is missing, stale, or quarantined.
      const reading = await resolveTodayReading(
        // Quiet: `iching today` can run from a shell greeting on every prompt, so
        // a corrupt cache must not spam stderr there (the hook is quiet for the
        // same reason; the interactive TUI stays loud and surfaces the notice).
        new JsonDailyCacheStore(paths.cache, { quiet: true }),
        new JsonlJournalStore(paths.state),
        () => today,
      );

      if (!reading) {
        // A state, not an error: a calm invitation on stdout, exit 0.
        // Scripts and shell greetings can run this without special-casing.
        if (opts.json) {
          outputJson(noTodayToJson(today));
        } else {
          console.log("no reading yet today — run `iching` to cast");
        }
        return;
      }

      if (opts.json) {
        outputJson(todayToJson(reading));
      } else {
        console.log(formatTodayPlain(reading));
      }
    });
}
