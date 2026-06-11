// Scene-construction helpers shared by main.ts and reading-flow.
// These centralize the wiring patterns that previously lived inline
// (DetailScene + getHexagramHistory hydration, plus the SceneRouter
// factories used by browse/journal navigation).

import type { DisplayLanguage, ReflectionNote } from "@iching/core";
import {
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
 * Committed notes are appended to the journal JSONL fire-and-forget — a write
 * failure must not crash the scene loop (the note stays visible in-session
 * and the journal file remains intact).
 */
export function makeJournalScene(deps: JournalDeps): JournalScene {
  return new JournalScene(deps.entries, {
    today: localToday,
    onNote: (entry, text) => {
      const note: ReflectionNote = {
        kind: "note",
        ref: entry.timestamp ?? entry.date,
        date: localToday(),
        timestamp: new Date().toISOString(),
        text,
      };
      deps.journal.appendNote(note).catch(() => {});
    },
  });
}

/** SceneRouter factory for the journal path: handles openJournalReading, openDetail, openDictionary, openJournal. */
export function makeJournalFactory(deps: JournalDeps): SceneFactory {
  return (signal): Scene | null => {
    if (signal.type === "openJournalReading") {
      const entry = deps.entries.find(
        (e) => e.timestamp === signal.key || e.date === signal.key,
      );
      if (!entry) return makeJournalScene(deps);
      const cs = new CastScene(
        entry.cast,
        "reduced",
        deps.session.cols,
        deps.glyphConfig,
        deps.session.rows,
        entry.intention,
        { language: deps.language },
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
    return null;
  };
}

/** Drain the journal stream into an array of entries, notes attached. */
export async function loadJournalEntries(
  journal: JsonlJournalStore,
): Promise<AnnotatedEntry[]> {
  return loadEntriesWithNotes(journal);
}
