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
  loadJournalEntries,
  makeBrowseFactory,
  makeDetailScene,
  makeJournalFactory,
  makeJournalScene,
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

  test("typed home (esc-from-replay) returns to the journal list, not the home loop", () => {
    // A replayed CastScene's esc emits { type: "home" }. Unhandled, the
    // journal router exits all the way to Home — but the replay footer says
    // "back", so esc must land on the journal list again.
    const factory = makeJournalFactory({
      journal,
      entries: [],
      session: { cols: 80, rows: 24 },
    });
    const scene = factory({ type: "home" });
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

describe("makeJournalScene — reflection-note persistence wiring", () => {
  let dir: string;
  let journal: JsonlJournalStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "journal-scene-factory-test-"));
    journal = new JsonlJournalStore(join(dir, "history.jsonl"));
  });

  test("a note committed in the scene lands in the JSONL as kind:note", async () => {
    await journal.append({
      date: "2026-01-02",
      cast: {
        lines: [
          { value: 7, isYang: true, isChanging: false },
          { value: 8, isYang: false, isChanging: false },
          { value: 7, isYang: true, isChanging: false },
          { value: 8, isYang: false, isChanging: false },
          { value: 7, isYang: true, isChanging: false },
          { value: 8, isYang: false, isChanging: false },
        ],
        primary: 39,
        becoming: null,
        changingPositions: [],
        nuclear: 1,
        polarity: 2,
        mirror: 1,
        diagonal: 2,
      },
      timestamp: "2026-01-02T09:00:00.000Z",
    });
    const entries = await loadJournalEntries(journal);
    const scene = makeJournalScene({
      journal,
      entries,
      session: { cols: 80, rows: 24 },
    });
    const ctx = { cols: 80, rows: 24, colorSupport: "truecolor", done: false } as const;
    scene.enter(ctx);

    scene.handleKey({ type: "char", char: "n" }, ctx);
    for (const ch of "noted at night") {
      scene.handleKey({ type: "char", char: ch }, ctx);
    }
    scene.handleKey({ type: "enter" }, ctx);

    // The append is fire-and-forget; poll the store until it lands.
    let texts: string[] = [];
    for (let i = 0; i < 40 && texts.length === 0; i++) {
      texts = [];
      for await (const note of journal.streamNotes()) texts.push(note.text);
      if (texts.length === 0) await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(texts).toEqual(["noted at night"]);

    // And a reload sees the note attached to its reading.
    const reloaded = await loadJournalEntries(journal);
    expect(reloaded[0].notes.map((n) => n.text)).toEqual(["noted at night"]);
    expect(reloaded[0].notes[0].ref).toBe("2026-01-02T09:00:00.000Z");
  });
});
