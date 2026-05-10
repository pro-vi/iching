// Tests for the typed SceneFactory contract. These pin the exact bug class
// that slipped through Commit C: the dict standalone command had a (id: string)
// factory that would crash at runtime once SceneRouter started passing typed
// SceneSignal objects instead of dotted strings.

import { describe, test, expect, beforeEach } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlJournalStore } from "@iching/storage";
import { BrowseScene, DetailScene, JournalScene } from "@iching/terminal";
import {
  makeBrowseFactory,
  makeJournalFactory,
} from "../app/scene-factories.ts";

describe("makeBrowseFactory", () => {
  let dir: string;
  let journal: JsonlJournalStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "browse-factory-test-"));
    journal = new JsonlJournalStore(join(dir, "history.jsonl"));
  });

  test("typed openDetail signal returns DetailScene", () => {
    const factory = makeBrowseFactory({ journal });
    const scene = factory({ type: "openDetail", kw: 1 });
    expect(scene).toBeInstanceOf(DetailScene);
  });

  test("typed openDetail with valid kw range produces DetailScene", () => {
    const factory = makeBrowseFactory({ journal });
    for (const kw of [1, 32, 64]) {
      const scene = factory({ type: "openDetail", kw });
      expect(scene).toBeInstanceOf(DetailScene);
    }
  });

  test("returns null for unrelated signals so router can bubble up", () => {
    const factory = makeBrowseFactory({ journal });
    expect(factory({ type: "openJournal" })).toBeNull();
    expect(factory({ type: "openSettings" })).toBeNull();
  });
});

describe("makeJournalFactory", () => {
  let dir: string;
  let journal: JsonlJournalStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "journal-factory-test-"));
    journal = new JsonlJournalStore(join(dir, "history.jsonl"));
  });

  test("typed openDetail returns DetailScene", () => {
    const factory = makeJournalFactory({
      journal,
      entries: [],
      session: { cols: 80, rows: 24 },
    });
    const scene = factory({ type: "openDetail", kw: 5 });
    expect(scene).toBeInstanceOf(DetailScene);
  });

  test("typed openDictionary returns BrowseScene", () => {
    const factory = makeJournalFactory({
      journal,
      entries: [],
      session: { cols: 80, rows: 24 },
    });
    const scene = factory({ type: "openDictionary" });
    expect(scene).toBeInstanceOf(BrowseScene);
  });

  test("typed openJournal resets to JournalScene (j-from-replay path)", () => {
    const factory = makeJournalFactory({
      journal,
      entries: [],
      session: { cols: 80, rows: 24 },
    });
    const scene = factory({ type: "openJournal" });
    expect(scene).toBeInstanceOf(JournalScene);
  });
});
