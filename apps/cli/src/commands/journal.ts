import { Command } from "commander";
import { GUA } from "@iching/core";
import type { HistoryEntry } from "@iching/core";
import { resolvePaths, JsonlJournalStore } from "@iching/storage";
import {
  formatJournalListPlain,
  formatJournalShowPlain,
} from "../output/plain.js";
import { outputJson } from "../output/json.js";
import { localToday } from "../util/today.js";

export function registerJournalCommand(program: Command): void {
  const journal = program
    .command("journal")
    .description("View reading journal");

  journal
    .command("list")
    .description("List recent readings (most recent first)")
    .option("--since <date>", "show readings since date (YYYY-MM-DD)")
    .option("--limit <n>", "maximum entries to show", "20")
    .option("--all", "show all entries (no limit)")
    .action(async (cmdOpts) => {
      const globalOpts = program.opts();
      const paths = resolvePaths(
        globalOpts.dataDir ? { dataDir: globalOpts.dataDir } : undefined,
      );
      const store = new JsonlJournalStore(paths.state);

      const allEntries: HistoryEntry[] = [];
      const query = { since: cmdOpts.since };

      for await (const entry of store.stream(query)) {
        allEntries.push(entry);
      }

      // Most recent first, then limit
      allEntries.reverse();
      const limit = cmdOpts.all ? allEntries.length : Number(cmdOpts.limit);
      const entries = allEntries.slice(0, limit);

      if (globalOpts.json) {
        outputJson(entries);
      } else {
        if (entries.length === 0) {
          console.log("No readings found.");
        } else {
          console.log(formatJournalListPlain(entries));
        }
      }
    });

  journal
    .command("show")
    .description("Show a specific day's reading")
    .argument("<date>", "date (YYYY-MM-DD), 'today', or 'latest'")
    .action(async (dateArg: string) => {
      const globalOpts = program.opts();
      const paths = resolvePaths(
        globalOpts.dataDir ? { dataDir: globalOpts.dataDir } : undefined,
      );
      const store = new JsonlJournalStore(paths.state);

      // Resolve special date keywords
      let targetDate: string | null = null;
      if (dateArg === "today") {
        targetDate = localToday();
      } else if (dateArg === "latest") {
        targetDate = null; // find the last entry
      } else {
        targetDate = dateArg;
      }

      let found: HistoryEntry | null = null;

      if (dateArg === "latest") {
        found = await store.latest();
      } else {
        for await (const entry of store.stream()) {
          if (entry.date === targetDate) {
            found = entry;
          }
        }
      }

      if (!found) {
        const label = dateArg === "today" ? `today (${localToday()})` : dateArg;
        console.error(`No reading found for ${label}`);
        process.exit(1);
      }

      if (globalOpts.json) {
        outputJson(found);
      } else {
        console.log(formatJournalShowPlain(found));
      }
    });
}
