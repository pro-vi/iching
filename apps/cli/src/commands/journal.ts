import { Command } from "commander";
import { access, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { GUA, computeJournalPatterns, compareEntryTime } from "@iching/core";
import type { HistoryEntry, ReflectionNote } from "@iching/core";
import {
  resolvePaths,
  JsonlJournalStore,
  noteMatchesEntry,
  entryNoteRef,
  stripTerminalControls,
} from "@iching/storage";
import {
  formatJournalListPlain,
  formatJournalShowPlain,
  formatJournalPatternsPlain,
} from "../output/plain.js";
import { outputJson, journalEntryToJson, journalPatternsToJson } from "../output/json.js";
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

/**
 * Calm preflight before any journal read. Torn LINES are tolerated by the
 * reader (skipped, counted); a whole-file read failure — a directory left at
 * the path, permission denied — would otherwise surface a raw `EISDIR`/`EACCES`
 * at the user. A missing journal is fine (the reader yields empty). Mirrors the
 * calm config-write errors the rest of the app already gives.
 */
async function assertJournalReadable(statePath: string): Promise<void> {
  try {
    const info = await stat(statePath);
    if (!info.isDirectory()) {
      await access(statePath, constants.R_OK);
      return; // present, a file, readable — proceed to the read
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return; // no journal yet — reads empty
    // any other stat/access failure falls through to the calm message below
  }
  console.error(`iching: couldn't read your journal at ${statePath} (permission denied, or not a file?).`);
  process.exit(1);
}

/**
 * Reject a malformed date argument loudly, the same way `list`/`patterns` guard
 * `--since`/`--until` — so a typo ("2025-1-1", "01/01/2025") reads as the format
 * error it is, not a misleading "No reading found" that implies an empty day.
 * One helper so every date-taking surface shares the rule (no parity drift).
 */
function assertValidDateArg(value: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    console.error(`Invalid ${label} "${value}": expected a date in YYYY-MM-DD format.`);
    process.exit(1);
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
    .option("--until <date>", "show readings until date (YYYY-MM-DD)")
    .option("--limit <n>", "maximum entries to show", "20")
    .option("--all", "show all entries (no limit)")
    .option("--hexagram <n>", "only readings where hexagram <n> is primary or becoming")
    .action(async (cmdOpts) => {
      const globalOpts = program.opts();
      const paths = resolvePaths(
        globalOpts.dataDir ? { dataDir: globalOpts.dataDir } : undefined,
      );
      const store = new JsonlJournalStore(paths.state);
      await assertJournalReadable(paths.state);

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
      if (cmdOpts.since !== undefined) assertValidDateArg(cmdOpts.since, "--since");
      if (cmdOpts.until !== undefined) assertValidDateArg(cmdOpts.until, "--until");
      // An inverted window can never hold a reading — catch the typo loudly
      // instead of printing a misleading "no readings found".
      if (cmdOpts.since && cmdOpts.until && cmdOpts.since > cmdOpts.until) {
        console.error(
          `Invalid range: --since "${cmdOpts.since}" is after --until "${cmdOpts.until}".`,
        );
        process.exit(1);
      }

      const allEntries: HistoryEntry[] = [];
      const query = { since: cmdOpts.since, until: cmdOpts.until };

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

      // Most recent first by the shared recency comparator (NOT append order),
      // then limit — matches the TUI list and the pane's ◉ accent exactly (same
      // time-key, same cast-content tie-break for same-day undated readings), so
      // --limit takes the latest readings even on an out-of-order / imported
      // journal and never disagrees with the pane on a tied instant.
      allEntries.sort((a, b) => compareEntryTime(b, a));
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
    .command("patterns")
    .description("Observe patterns across the journal (distribution, cadence, balance)")
    .option("--since <date>", "only readings since date (YYYY-MM-DD)")
    .option("--until <date>", "only readings until date (YYYY-MM-DD)")
    .action(async (cmdOpts) => {
      const globalOpts = program.opts();
      const paths = resolvePaths(
        globalOpts.dataDir ? { dataDir: globalOpts.dataDir } : undefined,
      );
      const store = new JsonlJournalStore(paths.state);
      await assertJournalReadable(paths.state);

      if (cmdOpts.since !== undefined) assertValidDateArg(cmdOpts.since, "--since");
      if (cmdOpts.until !== undefined) assertValidDateArg(cmdOpts.until, "--until");
      // An inverted window can never hold a reading — catch the typo loudly
      // instead of the calm "No readings to observe yet" (which implies none exist).
      if (cmdOpts.since && cmdOpts.until && cmdOpts.since > cmdOpts.until) {
        console.error(
          `Invalid range: --since "${cmdOpts.since}" is after --until "${cmdOpts.until}".`,
        );
        process.exit(1);
      }

      const entries: HistoryEntry[] = [];
      for await (const entry of store.stream({ since: cmdOpts.since, until: cmdOpts.until })) {
        entries.push(entry);
      }

      const today = localToday();
      // A historical window (--until in the past) is a retrospective: measure
      // cadence and "this month" AS OF the window's end, not real today.
      // Otherwise idleDays counts the months since the window closed and
      // recent30/thisMonth read 0 — numbers about now, not about the period
      // observed. An open-ended or future --until keeps real today.
      const asOf = cmdOpts.until && cmdOpts.until < today ? cmdOpts.until : today;
      const patterns = computeJournalPatterns(entries, asOf);
      if (globalOpts.json) {
        outputJson(journalPatternsToJson(patterns));
      } else {
        // Disclose the window so a bounded report reads as the retrospective it
        // is; drop the now-relative "this month" when the window ends in the past.
        if (cmdOpts.since || cmdOpts.until) {
          const from = cmdOpts.since ?? "the beginning";
          const to = cmdOpts.until ?? "now";
          console.log(`Observing ${from} through ${to}`);
        }
        const historical = cmdOpts.until !== undefined && cmdOpts.until < today;
        console.log(formatJournalPatternsPlain(patterns, { omitThisMonth: historical }));
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
      await assertJournalReadable(paths.state);

      // Resolve special date keywords
      let targetDate: string | null = null;
      if (dateArg === "today") {
        targetDate = localToday();
      } else if (dateArg === "latest") {
        targetDate = null; // find the last entry
      } else {
        assertValidDateArg(dateArg, "date");
        targetDate = dateArg;
      }

      let found: HistoryEntry | null = null;

      if (dateArg === "latest") {
        found = await store.latest();
      } else {
        // A day's reading is its chronologically LATEST cast (by the shared
        // recency comparator), not merely the last appended — so an out-of-order
        // or imported journal doesn't surface an earlier reading as "the day's".
        // Same comparator as `journal list` and the pane, so a tied instant
        // resolves to the same reading everywhere.
        for await (const entry of store.stream()) {
          if (entry.date === targetDate && (found === null || compareEntryTime(entry, found) >= 0)) {
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
      await assertJournalReadable(paths.state);

      // Strip terminal control sequences before the text becomes durable —
      // a persisted note is replayed raw on every `journal show`, so ESC/OSC
      // bytes in the argument would replay as live control sequences forever.
      const trimmed = stripTerminalControls(text).trim();
      if (!trimmed) {
        console.error("Note text is empty.");
        process.exit(1);
      }

      let target: HistoryEntry | null = null;
      if (cmdOpts.date !== undefined) {
        assertValidDateArg(cmdOpts.date, "--date");
        // A day's reading is its chronologically LATEST cast (by the shared
        // recency comparator), not merely the last appended — so `note --date`
        // annotates the same reading that `journal show <date>` displays, even
        // for an out-of-order journal, and resolves a tied instant identically.
        for await (const entry of store.stream()) {
          if (entry.date === cmdOpts.date && (target === null || compareEntryTime(entry, target) >= 0)) {
            target = entry;
          }
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
        // Precise content/timestamp ref (NOT the bare date) — the same key the
        // TUI note path writes. A date ref resolves to the day's LAST cast, so
        // on a legacy timestamp-less day with several readings it would re-attach
        // to a different reading than the comparator just selected as `target`.
        ref: entryNoteRef(target),
        date: localToday(),
        timestamp: new Date().toISOString(),
        text: trimmed,
      };
      try {
        await store.appendNote(note);
      } catch {
        // Write failure (read-only or full data dir, a directory at the sidecar
        // path) — the read commands already degrade calmly; the note write
        // should too, not a raw EROFS/EISDIR. Nothing was saved.
        console.error("iching: couldn't save your note (read-only or full data dir?).");
        process.exit(1);
      }

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
