import { Command } from "commander";
import { die } from "../util/die.js";
import { access, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { GUA, computeJournalPatterns, compareEntryTime } from "@iching/core";
import type { HistoryEntry, ReflectionNote } from "@iching/core";
import {
  JsonlJournalStore,
  JsonConfigStore,
  noteMatchesEntry,
  entryNoteRef,
  stripTerminalControls,
  errnoCode,
} from "@iching/storage";
import { resolvePathsFor } from "../util/paths.js";
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
    if (errnoCode(err) === "ENOENT") return; // no journal yet — reads empty
    // any other stat/access failure falls through to the calm message below
  }
  die(`iching: couldn't read your journal at ${statePath} (permission denied, or not a file?).`);
}

/**
 * Reject a malformed date argument loudly, the same way `list`/`patterns` guard
 * `--since`/`--until` — so a typo ("2025-1-1", "01/01/2025") reads as the format
 * error it is, not a misleading "No reading found" that implies an empty day.
 * One helper so every date-taking surface shares the rule (no parity drift).
 */
function assertValidDateArg(value: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    die(`Invalid ${label} "${value}": expected a date in YYYY-MM-DD format.`);
  }
}

/** Validate a --since/--until window: each bound (when given) must be YYYY-MM-DD,
 *  and since must not fall after until. An inverted window can never hold a reading,
 *  so catch the typo loudly instead of printing a misleading "nothing found". */
function assertValidDateWindow(
  since: string | undefined,
  until: string | undefined,
): void {
  if (since !== undefined) assertValidDateArg(since, "--since");
  if (until !== undefined) assertValidDateArg(until, "--until");
  if (since && until && since > until) {
    die(`Invalid range: --since "${since}" is after --until "${until}".`);
  }
}

/** The day's reading on `date`: its chronologically LATEST cast by the shared
 *  recency comparator (not merely the last appended), so `journal show <date>` and
 *  `note --date` resolve to the same reading — tied instants included — even for an
 *  out-of-order or imported journal. */
async function latestEntryOnDate(
  store: JsonlJournalStore,
  date: string | null,
): Promise<HistoryEntry | null> {
  let latest: HistoryEntry | null = null;
  for await (const entry of store.stream()) {
    if (entry.date === date && (latest === null || compareEntryTime(entry, latest) >= 0)) {
      latest = entry;
    }
  }
  return latest;
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
      const paths = resolvePathsFor(globalOpts.dataDir);
      const store = new JsonlJournalStore(paths.state);
      await assertJournalReadable(paths.state);

      // Validate the hexagram filter before reading anything.
      let hexFilter: number | undefined;
      if (cmdOpts.hexagram !== undefined) {
        hexFilter = Number(cmdOpts.hexagram);
        if (!Number.isInteger(hexFilter) || hexFilter < 1 || hexFilter > GUA.length) {
          die(`Invalid --hexagram "${cmdOpts.hexagram}": expected a number 1-${GUA.length}.`);
        }
      }

      // Validate --limit only when it actually applies. --all discards it
      // (line below slices the full list), so `journal list --all --limit abc`
      // must not reject a flag it ignores. Fail loudly otherwise — never an
      // accidental empty list (Number("abc") is NaN; slice(0, NaN) drops all).
      let limit = 0;
      if (!cmdOpts.all) {
        limit = Number(cmdOpts.limit);
        if (!Number.isInteger(limit) || limit < 1) {
          die(`Invalid --limit "${cmdOpts.limit}": expected a positive integer.`);
        }
      }
      assertValidDateWindow(cmdOpts.since, cmdOpts.until);

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
      const paths = resolvePathsFor(globalOpts.dataDir);
      const store = new JsonlJournalStore(paths.state);
      await assertJournalReadable(paths.state);

      assertValidDateWindow(cmdOpts.since, cmdOpts.until);

      const entries: HistoryEntry[] = [];
      for await (const entry of store.stream({ since: cmdOpts.since, until: cmdOpts.until })) {
        entries.push(entry);
      }

      const tz = (await new JsonConfigStore(paths.config).load()).timezone;
      const today = localToday(tz);
      // A historical window (--until in the past) is a retrospective: measure
      // cadence and "this month" AS OF the window's end, not real today.
      // Otherwise idleDays counts the months since the window closed and
      // recent30/thisMonth read 0 — numbers about now, not about the period
      // observed. An open-ended or future --until keeps real today.
      const asOf = cmdOpts.until && cmdOpts.until < today ? cmdOpts.until : today;
      const patterns = computeJournalPatterns(entries, asOf, undefined, tz);
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
      const paths = resolvePathsFor(globalOpts.dataDir);
      const store = new JsonlJournalStore(paths.state);
      await assertJournalReadable(paths.state);
      const tz = (await new JsonConfigStore(paths.config).load()).timezone;

      // Resolve special date keywords
      let targetDate: string | null = null;
      if (dateArg === "today") {
        targetDate = localToday(tz);
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
        found = await latestEntryOnDate(store, targetDate);
      }

      if (!found) {
        const label = dateArg === "today" ? `today (${localToday(tz)})` : dateArg;
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
      const paths = resolvePathsFor(globalOpts.dataDir);
      const store = new JsonlJournalStore(paths.state);
      await assertJournalReadable(paths.state);
      const tz = (await new JsonConfigStore(paths.config).load()).timezone;

      // Strip terminal control sequences before the text becomes durable —
      // a persisted note is replayed raw on every `journal show`, so ESC/OSC
      // bytes in the argument would replay as live control sequences forever.
      const trimmed = stripTerminalControls(text).trim();
      if (!trimmed) {
        die("Note text is empty.");
      }

      let target: HistoryEntry | null = null;
      if (cmdOpts.date !== undefined) {
        assertValidDateArg(cmdOpts.date, "--date");
        target = await latestEntryOnDate(store, cmdOpts.date);
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
        date: localToday(tz),
        timestamp: new Date().toISOString(),
        text: trimmed,
      };
      try {
        await store.appendNote(note);
      } catch {
        // Write failure (read-only or full data dir, a directory at the sidecar
        // path) — the read commands already degrade calmly; the note write
        // should too, not a raw EROFS/EISDIR. Nothing was saved.
        die("iching: couldn't save your note (read-only or full data dir?).");
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
