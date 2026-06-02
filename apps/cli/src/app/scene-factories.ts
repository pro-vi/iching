// Scene-construction helpers shared by main.ts and reading-flow.
// These centralize the wiring patterns that previously lived inline
// (DetailScene + getHexagramHistory hydration, plus the SceneRouter
// factories used by browse/journal navigation).

import type { HistoryEntry } from "@iching/core";
import { getHexagramHistory, type JsonlJournalStore } from "@iching/storage";
import {
  BrowseScene,
  CastScene,
  type CastGlyphInput,
  DetailScene,
  JournalScene,
  type Scene,
  type SceneFactory,
  ShuoGuaChapterScene,
} from "@iching/terminal";

export interface SessionDims {
  cols: number;
  rows: number;
}

export interface DetailDeps {
  /** Optional — interactive home flow passes the saved glyph config; standalone CLI doesn't need it. */
  glyphConfig?: CastGlyphInput;
  journal: JsonlJournalStore;
}

export interface JournalDeps extends DetailDeps {
  entries: HistoryEntry[];
  session: SessionDims;
}

/** Construct DetailScene + kick off async history hydration. */
export function makeDetailScene(kw: number, deps: DetailDeps): DetailScene {
  const scene = new DetailScene(kw, deps.glyphConfig);
  getHexagramHistory(deps.journal, kw).then((h) =>
    scene.setHistory(h.castCount, h.lastCastDate),
  );
  return scene;
}

/** SceneRouter factory for the dictionary path: handles openDetail, falls back through. */
export function makeBrowseFactory(deps: DetailDeps): SceneFactory {
  return (signal): Scene | null => {
    if (signal.type === "openDetail") return makeDetailScene(signal.kw, deps);
    if (signal.type === "openShuoguaChapter") {
      return new ShuoGuaChapterScene(signal.chapter, signal.op);
    }
    return null;
  };
}

/** SceneRouter factory for the journal path: handles openJournalReading, openDetail, openDictionary, openJournal. */
export function makeJournalFactory(deps: JournalDeps): SceneFactory {
  return (signal): Scene | null => {
    if (signal.type === "openJournalReading") {
      const entry = deps.entries.find(
        (e) => e.timestamp === signal.key || e.date === signal.key,
      );
      if (!entry) return new JournalScene(deps.entries);
      const cs = new CastScene(
        entry.cast,
        "reduced",
        deps.session.cols,
        deps.glyphConfig,
        deps.session.rows,
        entry.intention,
      );
      cs.skipToComplete(false);
      return cs;
    }
    if (signal.type === "openDetail") return makeDetailScene(signal.kw, deps);
    if (signal.type === "openShuoguaChapter") {
      return new ShuoGuaChapterScene(signal.chapter, signal.op);
    }
    if (signal.type === "openDictionary") return new BrowseScene();
    // `j` from a replayed CastScene inside the journal router → reset to the journal list.
    if (signal.type === "openJournal") return new JournalScene(deps.entries);
    return null;
  };
}

/** Drain the journal stream into an array of entries. */
export async function loadJournalEntries(
  journal: JsonlJournalStore,
): Promise<HistoryEntry[]> {
  const entries: HistoryEntry[] = [];
  for await (const entry of journal.stream()) {
    entries.push(entry);
  }
  return entries;
}
