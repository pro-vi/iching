import { Command } from "commander";
import { resolvePaths, JsonDailyCacheStore, JsonlJournalStore } from "@iching/storage";
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

      const today = localToday();
      // Cache-first, journal-fallback via the shared durable-recovery resolver,
      // so `today` agrees with the TUI [t] reopen and the hook on what today's
      // reading is — even when the cache is missing, stale, or quarantined.
      const reading = await resolveTodayReading(
        new JsonDailyCacheStore(paths.cache),
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
