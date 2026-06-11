import { Command } from "commander";
import { resolvePaths, JsonDailyCacheStore } from "@iching/storage";
import { formatTodayPlain } from "../output/plain.js";
import { outputJson, todayToJson, noTodayToJson } from "../output/json.js";
import { localToday } from "../util/today.js";

export function registerTodayCommand(program: Command): void {
  program
    .command("today")
    .description("Show today's reading (cast in the TUI)")
    .action(async () => {
      const opts = program.opts();
      const paths = resolvePaths(
        opts.dataDir ? { dataDir: opts.dataDir } : undefined,
      );
      const store = new JsonDailyCacheStore(paths.cache);

      const today = localToday();
      const cache = await store.read();

      // A stale cache (yesterday's reading) counts as "no reading yet today".
      if (!cache || cache.date !== today) {
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
        outputJson(todayToJson(cache));
      } else {
        console.log(formatTodayPlain(cache));
      }
    });
}
