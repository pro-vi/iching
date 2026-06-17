import { Command } from "commander";
import { resolvePaths, JsonDailyCacheStore, JsonlJournalStore } from "@iching/storage";
import { buildStructure } from "@iching/core";
import type { DailyCache } from "@iching/core";
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

      // Prefer the daily cache, but fall back to the journal when it misses or
      // is stale. A successful journal append can outlive its cache write — the
      // cache may be absent, hold yesterday's reading, or have been quarantined
      // as corrupt — while history.jsonl still holds today's cast. The journal
      // is the durable record (the hook recovers from it the same way), so
      // `today` must too rather than claim "no reading yet" over a real one.
      let reading: DailyCache | null = cache && cache.date === today ? cache : null;
      if (!reading) {
        // Best-effort like the hook: a blocked/unreadable data dir resolves to
        // null (→ the calm invitation below), never a crash.
        const recovered = await new JsonlJournalStore(paths.state).latest().catch(() => null);
        if (recovered && recovered.date === today) {
          // The journal entry carries no structure/shown; derive structure from
          // the cast (as the hook does) and mark it shown — it was cast today.
          reading = {
            date: recovered.date,
            cast: recovered.cast,
            shown: true,
            structure: buildStructure(recovered.cast),
            intention: recovered.intention,
            method: recovered.method,
            rng: recovered.rng,
          };
        }
      }

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
