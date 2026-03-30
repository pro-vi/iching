import { Command } from "commander";
import { GUA } from "@iching/core";
import type { HistoryEntry } from "@iching/core";
import { resolvePaths, JsonlJournalStore } from "@iching/storage";
import {
  formatJournalListPlain,
  formatJournalShowPlain,
} from "../output/plain.js";
import { outputJson } from "../output/json.js";

export function registerJournalCommand(program: Command): void {
  const journal = program
    .command("journal")
    .description("View reading journal");

  journal
    .command("list")
    .description("List recent readings")
    .option("--since <date>", "show readings since date (YYYY-MM-DD)")
    .option("--limit <n>", "maximum entries to show", "20")
    .action(async (cmdOpts) => {
      const globalOpts = program.opts();
      const paths = resolvePaths(
        globalOpts.dataDir ? { dataDir: globalOpts.dataDir } : undefined,
      );
      const store = new JsonlJournalStore(paths.state);

      const entries: HistoryEntry[] = [];
      const query = {
        since: cmdOpts.since,
        limit: Number(cmdOpts.limit),
      };

      for await (const entry of store.stream(query)) {
        entries.push(entry);
      }

      if (globalOpts.json) {
        outputJson(entries);
      } else {
        console.log(formatJournalListPlain(entries));
      }
    });

  journal
    .command("show")
    .description("Show a specific day's reading")
    .argument("<date>", "date to show (YYYY-MM-DD)")
    .action(async (date: string) => {
      const globalOpts = program.opts();
      const paths = resolvePaths(
        globalOpts.dataDir ? { dataDir: globalOpts.dataDir } : undefined,
      );
      const store = new JsonlJournalStore(paths.state);

      let found: HistoryEntry | null = null;
      for await (const entry of store.stream()) {
        if (entry.date === date) {
          found = entry;
        }
      }

      if (!found) {
        console.error(`No reading found for ${date}`);
        process.exit(1);
      }

      if (globalOpts.json) {
        outputJson(found);
      } else {
        console.log(formatJournalShowPlain(found));
      }
    });
}
