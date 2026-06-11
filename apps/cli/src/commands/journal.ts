import { Command } from "commander";
import { GUA } from "@iching/core";
import type { HistoryEntry, ReflectionNote } from "@iching/core";
import { resolvePaths, JsonlJournalStore, noteMatchesEntry } from "@iching/storage";
import {
  formatJournalListPlain,
  formatJournalShowPlain,
} from "../output/plain.js";
import { outputJson, journalEntryToJson } from "../output/json.js";
import { localToday } from "../util/today.js";

/**
 * Quiet damage report after a read: torn/malformed lines were skipped, the
 * readings on the surrounding lines survived. stderr so --json stays clean.
 */
function reportSkippedLines(store: JsonlJournalStore): void {
  if (store.skippedLines > 0) {
    console.error(`note: ${store.skippedLines} unreadable journal line(s) skipped`);
  }
}

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
    .option("--hexagram <n>", "only readings where hexagram <n> is primary or becoming")
    .action(async (cmdOpts) => {
      const globalOpts = program.opts();
      const paths = resolvePaths(
        globalOpts.dataDir ? { dataDir: globalOpts.dataDir } : undefined,
      );
      const store = new JsonlJournalStore(paths.state);

      // Validate the hexagram filter before reading anything.
      let hexFilter: number | undefined;
      if (cmdOpts.hexagram !== undefined) {
        hexFilter = Number(cmdOpts.hexagram);
        if (!Number.isInteger(hexFilter) || hexFilter < 1 || hexFilter > GUA.length) {
          console.error(
            `Invalid --hexagram "${cmdOpts.hexagram}": expected a number 1-${GUA.length}.`,
          );
          process.exit(1);
        }
      }

      // Validate --limit / --since the same way: fail loudly, never an
      // accidental empty list (Number("abc") is NaN; slice(0, NaN) drops all).
      const limit = Number(cmdOpts.limit);
      if (!Number.isInteger(limit) || limit < 1) {
        console.error(
          `Invalid --limit "${cmdOpts.limit}": expected a positive integer.`,
        );
        process.exit(1);
      }
      if (cmdOpts.since !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(cmdOpts.since)) {
        console.error(
          `Invalid --since "${cmdOpts.since}": expected a date in YYYY-MM-DD format.`,
        );
        process.exit(1);
      }

      const allEntries: HistoryEntry[] = [];
      const query = { since: cmdOpts.since };

      for await (const entry of store.stream(query)) {
        if (
          hexFilter !== undefined &&
          entry.cast.primary !== hexFilter &&
          entry.cast.becoming !== hexFilter
        ) {
          continue;
        }
        allEntries.push(entry);
      }

      // Most recent first, then limit
      allEntries.reverse();
      const entries = cmdOpts.all ? allEntries : allEntries.slice(0, limit);

      if (globalOpts.json) {
        outputJson(entries.map((entry) => journalEntryToJson(entry)));
      } else {
        if (entries.length === 0) {
          console.log("No readings found.");
        } else {
          console.log(formatJournalListPlain(entries));
        }
      }
      reportSkippedLines(store);
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
        reportSkippedLines(store);
        process.exit(1);
      }

      // Reflection notes attached to this reading (matched by ref).
      const notes: ReflectionNote[] = [];
      for await (const note of store.streamNotes()) {
        if (noteMatchesEntry(note, found)) notes.push(note);
      }

      if (globalOpts.json) {
        outputJson(journalEntryToJson(found, notes));
      } else {
        console.log(formatJournalShowPlain(found, notes));
      }
      reportSkippedLines(store);
    });

  journal
    .command("note")
    .description("Attach a reflection note to the latest reading")
    .argument("<text>", "note text")
    .option("--date <date>", "annotate the reading of a specific day (YYYY-MM-DD)")
    .action(async (text: string, cmdOpts) => {
      const globalOpts = program.opts();
      const paths = resolvePaths(
        globalOpts.dataDir ? { dataDir: globalOpts.dataDir } : undefined,
      );
      const store = new JsonlJournalStore(paths.state);

      const trimmed = text.trim();
      if (!trimmed) {
        console.error("Note text is empty.");
        process.exit(1);
      }

      let target: HistoryEntry | null = null;
      if (cmdOpts.date !== undefined) {
        // Last reading of that day (same rule the TUI uses for date refs).
        for await (const entry of store.stream()) {
          if (entry.date === cmdOpts.date) target = entry;
        }
      } else {
        target = await store.latest();
      }

      if (!target) {
        if (cmdOpts.date !== undefined) {
          console.error(`No reading found for ${cmdOpts.date}`);
        } else {
          console.error("No reading found to annotate.");
        }
        process.exit(1);
      }

      const note: ReflectionNote = {
        kind: "note",
        ref: target.timestamp ?? target.date,
        date: localToday(),
        timestamp: new Date().toISOString(),
        text: trimmed,
      };
      await store.appendNote(note);

      if (globalOpts.json) {
        outputJson({
          noted: { ref: note.ref, date: note.date, timestamp: note.timestamp, text: note.text },
          reading: journalEntryToJson(target),
        });
      } else {
        const g = GUA[target.cast.primary - 1];
        console.log(`Note added to ${target.date}  ${g.u} ${g.n} (${g.p})`);
      }
    });
}
