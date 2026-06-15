// Scene-construction helpers shared by main.ts and reading-flow.
// These centralize the wiring patterns that previously lived inline
// (DetailScene + getHexagramHistory hydration, plus the SceneRouter
// factories used by browse/journal navigation).

import type { DisplayLanguage, ReflectionNote } from "@iching/core";
import {
  entryNoteRef,
  getHexagramHistory,
  loadEntriesWithNotes,
  type AnnotatedEntry,
  type JsonlJournalStore,
} from "@iching/storage";
import {
  BrowseScene,
  CastScene,
  type CastGlyphInput,
  DetailScene,
  JournalScene,
  type JournalEntryView,
  type Scene,
  type SceneFactory,
} from "@iching/terminal";
import { localToday } from "../util/today.js";

export interface SessionDims {
  cols: number;
  rows: number;
}

export interface DetailDeps {
  /** Optional — interactive home flow passes the saved glyph config; standalone CLI doesn't need it. */
  glyphConfig?: CastGlyphInput;
  language?: DisplayLanguage;
  journal: JsonlJournalStore;
}

export interface JournalDeps extends DetailDeps {
  entries: JournalEntryView[];
  session: SessionDims;
}

/** Construct DetailScene + kick off async history hydration. */
export function makeDetailScene(
  kw: number,
  deps: DetailDeps,
  changedPositions?: number[],
): DetailScene {
  const scene = new DetailScene(kw, deps.glyphConfig, deps.language, changedPositions);
  getHexagramHistory(deps.journal, kw)
    .then((h) => scene.setHistory(h.castCount, h.lastCastDate))
    .catch(() => {
      // A corrupt journal must not surface as an unhandled rejection (which
      // would kill the process outside runScene's restore path) — the detail
      // scene simply renders without cast history.
    });
  return scene;
}

/** SceneRouter factory for the dictionary path: handles openDetail, falls back through. */
export function makeBrowseFactory(deps: DetailDeps): SceneFactory {
  return (signal): Scene | null => {
    if (signal.type === "openDetail") {
      return makeDetailScene(signal.kw, deps, signal.changedPositions);
    }
    return null;
  };
}

/**
 * Construct the journal list scene with reflection-note persistence wired in.
 * Committed notes are appended to the journal JSONL; the append promise is
 * returned so the scene can track each note honestly (pending → saved, or a
 * calm failed line when the bytes never land) and await in-flight writes on
 * exit. The scene attaches its own settle handlers, so a write failure never
 * crashes the scene loop or escapes as an unhandled rejection.
 */
export function makeJournalScene(deps: JournalDeps): JournalScene {
  return new JournalScene(deps.entries, {
    today: localToday,
    onNote: (entry, text) => {
      const note: ReflectionNote = {
        kind: "note",
        // Precise pointer to THIS reading: its timestamp, or a content key for a
        // legacy timestamp-less entry — so a note on one of several same-day
        // legacy casts re-attaches to the one annotated, not the day's last.
        ref: entryNoteRef(entry),
        date: localToday(),
        timestamp: new Date().toISOString(),
        text,
      };
      return deps.journal.appendNote(note);
    },
  });
}

/** SceneRouter factory for the journal path: handles openJournalReading, openDetail, openDictionary, openJournal. */
export function makeJournalFactory(deps: JournalDeps): SceneFactory {
  return (signal): Scene | null => {
    if (signal.type === "openJournalReading") {
      // The selected entry rides the signal by reference — no date/timestamp
      // lookup that could resolve the wrong reading when a day holds more than
      // one (legacy readings without timestamps).
      const entry = signal.entry;
      const cs = new CastScene(
        entry.cast,
        "reduced",
        deps.session.cols,
        deps.glyphConfig,
        deps.session.rows,
        entry.intention,
        // exitSignal "back": esc/q from a replayed reading pop the router
        // stack to the ORIGINAL journal list (cursor and search intact)
        // instead of unwinding the whole router to Home.
        { language: deps.language, exitSignal: "back" },
      );
      cs.skipToComplete(false);
      return cs;
    }
    if (signal.type === "openDetail") {
      return makeDetailScene(signal.kw, deps, signal.changedPositions);
    }
    if (signal.type === "openDictionary") return new BrowseScene();
    // `j` from a replayed CastScene inside the journal router → reset to the journal list.
    if (signal.type === "openJournal") return makeJournalScene(deps);
    // No scene inside this router emits `home` anymore (the replayed
    // CastScene's esc/q are `back` now) — anything else bubbles out so the
    // router exits gracefully and the home loop dispatches it.
    return null;
  };
}

/** Drain the journal stream into an array of entries, notes attached. */
export async function loadJournalEntries(
  journal: JsonlJournalStore,
): Promise<AnnotatedEntry[]> {
  try {
    return await loadEntriesWithNotes(journal);
  } catch {
    // A torn LINE is tolerated per-line inside the stream; a whole-file READ
    // failure (the history is unreadable — owned by root after a sudo run, a
    // directory left at the path, a failing mount) is different and would
    // otherwise crash the whole TUI session the moment the journal opens. Warn
    // honestly (deferred under the alt screen, flushed on exit) and open empty
    // rather than die — the readings aren't lost, just unreadable right now.
    console.error(
      "iching: couldn't read your journal (permission denied?); it opened empty, but your readings are not lost.",
    );
    return [];
  }
}
