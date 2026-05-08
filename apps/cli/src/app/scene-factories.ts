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
} from "@iching/terminal";

export interface SessionDims {
  cols: number;
  rows: number;
}

export interface DetailDeps {
  glyphConfig: CastGlyphInput;
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

/** SceneRouter factory for the dictionary path: handles `detail:N`, falls back to BrowseScene. */
export function makeBrowseFactory(deps: DetailDeps): SceneFactory {
  return (id: string): Scene => {
    if (id.startsWith("detail:")) {
      const kw = Number(id.slice(7));
      if (!Number.isInteger(kw) || kw < 1 || kw > 64) return new BrowseScene();
      return makeDetailScene(kw, deps);
    }
    return new BrowseScene();
  };
}

/** SceneRouter factory for the journal path: handles `reading:KEY`, `detail:N`, `dictionary`. */
export function makeJournalFactory(deps: JournalDeps): SceneFactory {
  return (id: string): Scene => {
    if (id.startsWith("reading:")) {
      const key = id.slice(8);
      const entry = deps.entries.find(
        (e) => e.timestamp === key || e.date === key,
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
    if (id.startsWith("detail:")) {
      const kw = Number(id.slice(7));
      if (!Number.isInteger(kw) || kw < 1 || kw > 64) return new JournalScene(deps.entries);
      return makeDetailScene(kw, deps);
    }
    if (id === "dictionary") return new BrowseScene();
    return new JournalScene(deps.entries);
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
