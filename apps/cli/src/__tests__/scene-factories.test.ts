// Tests for the typed SceneFactory contract. These pin the exact bug class
// that slipped through Commit C: the dict standalone command had a (id: string)
// factory that would crash at runtime once SceneRouter started passing typed
// SceneSignal objects instead of dotted strings.

import { describe, test, expect, beforeEach } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlJournalStore } from "@iching/storage";
import { BrowseScene, DetailScene, JournalScene } from "@iching/terminal";
import {
  makeBrowseFactory,
  makeDetailScene,
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

describe("makeDetailScene — history hydration crash safety", () => {
  test("a corrupt journal line never escapes as an unhandled rejection", async () => {
    const dir = await mkdtemp(join(tmpdir(), "detail-hydration-test-"));
    const path = join(dir, "history.jsonl");
    await writeFile(path, "this is not json\n", "utf-8");
    const journal = new JsonlJournalStore(path);

    // Without the .catch on the hydration promise this rejection would kill
    // the process outside runScene's restore path (terminal left raw).
    let unhandled: unknown = null;
    const onUnhandled = (err: unknown) => {
      unhandled = err;
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      const scene = makeDetailScene(1, { journal });
      expect(scene).toBeInstanceOf(DetailScene);
      await new Promise((resolve) => setTimeout(resolve, 25));
      expect(unhandled).toBeNull();
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
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

describe("cast context (changedPositions) pass-through", () => {
  let dir: string;
  let journal: JsonlJournalStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "cast-context-factory-test-"));
    journal = new JsonlJournalStore(join(dir, "history.jsonl"));
  });

  test("openDetail with changedPositions marks the DetailScene model", () => {
    const factory = makeBrowseFactory({ journal });
    const scene = factory({ type: "openDetail", kw: 21, changedPositions: [1, 4] });
    expect(scene).toBeInstanceOf(DetailScene);
    expect((scene as DetailScene).getModel().changedPositions).toEqual([1, 4]);
  });

  test("openDetail without changedPositions yields an unmarked model", () => {
    const factory = makeBrowseFactory({ journal });
    const scene = factory({ type: "openDetail", kw: 21 });
    expect((scene as DetailScene).getModel().changedPositions).toEqual([]);
  });
});
