// Tests for the typed SceneFactory contract. These pin the exact bug class
// that slipped through Commit C: the dict standalone command had a (id: string)
// factory that would crash at runtime once SceneRouter started passing typed
// SceneSignal objects instead of dotted strings.

import { describe, test, expect, beforeEach } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlJournalStore } from "@iching/storage";
import {
  BrowseScene,
  CastScene,
  DetailScene,
  JournalScene,
  type JournalEntryView,
  SceneRouter,
} from "@iching/terminal";
import {
  loadJournalEntries,
  makeBrowseFactory,
  makeDetailScene,
  makeJournalFactory,
  makeJournalScene,
} from "../app/scene-factories.ts";

/** Minimal all-young-line journal entry for replay/navigation tests. */
function makeReplayEntry(date: string, timestamp: string): JournalEntryView {
  return {
    date,
    timestamp,
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
  };
}

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

  test("home is not handled — it bubbles out for the home loop to dispatch", () => {
    // The replayed CastScene now emits `back` for esc/q (exitSignal), so no
    // scene inside the journal router emits `home`. Mapping it to a fresh
    // journal list would trap a genuine home signal inside the router.
    const factory = makeJournalFactory({
      journal,
      entries: [],
      session: { cols: 80, rows: 24 },
    });
    expect(factory({ type: "home" })).toBeNull();
  });

  test("a replayed reading emits back on esc/q — the router pops to the list", () => {
    const entries = [makeReplayEntry("2026-01-02", "2026-01-02T09:00:00.000Z")];
    const factory = makeJournalFactory({
      journal,
      entries,
      session: { cols: 80, rows: 24 },
    });
    const scene = factory({ type: "openJournalReading", key: "2026-01-02T09:00:00.000Z" });
    expect(scene).toBeInstanceOf(CastScene);

    const ctx = { cols: 80, rows: 24, colorSupport: "truecolor", done: false } as const;
    // Esc from the replay pops the router stack (back), it does NOT emit
    // home — home would unwind the whole journal router and lose the list.
    expect((scene as CastScene).handleKey({ type: "escape" }, ctx)).toEqual({ type: "back" });
    expect((scene as CastScene).handleKey({ type: "char", char: "q" }, ctx)).toEqual({
      type: "back",
    });
  });

  test("journal → replay → esc lands on the SAME list (cursor intact) → esc → out", () => {
    const entries = [
      makeReplayEntry("2026-01-01", "2026-01-01T09:00:00.000Z"),
      makeReplayEntry("2026-01-02", "2026-01-02T09:00:00.000Z"),
      makeReplayEntry("2026-01-03", "2026-01-03T09:00:00.000Z"),
    ];
    const deps = { journal, entries, session: { cols: 80, rows: 24 } };
    const list = makeJournalScene(deps);
    const factory = makeJournalFactory(deps);
    const router = new SceneRouter(list, factory);
    const ctx = { cols: 80, rows: 24, colorSupport: "truecolor", done: false } as const;
    list.enter(ctx);

    // Move the cursor (newest first: index 1 = 2026-01-02) and open the replay.
    list.handleKey({ type: "char", char: "j" }, ctx);
    const open = list.handleKey({ type: "enter" }, ctx);
    expect(open).toEqual({
      type: "openJournalReading",
      key: "2026-01-02T09:00:00.000Z",
    });

    // The router pushes the factory's replay scene…
    const replay = factory(open!);
    expect(replay).toBeInstanceOf(CastScene);
    router.push(replay!);

    // …and esc pops back to the ORIGINAL list instance, cursor untouched.
    expect(replay!.handleKey!({ type: "escape" }, ctx)).toEqual({ type: "back" });
    router.pop();
    expect(router.current()).toBe(list);
    expect(list.handleKey({ type: "enter" }, ctx)).toEqual({
      type: "openJournalReading",
      key: "2026-01-02T09:00:00.000Z",
    });

    // Esc on the list itself pops the router bottom — the home loop resumes.
    expect(list.handleKey({ type: "escape" }, ctx)).toEqual({ type: "back" });
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

  test("the note commit is await-able — exit() flushes the append to disk", async () => {
    // onNote returns the append promise, so the scene can be drained
    // deterministically (no polling): scene teardown awaits in-flight
    // writes before the process can move on.
    const entries = [makeReplayEntry("2026-01-02", "2026-01-02T09:00:00.000Z")];
    const scene = makeJournalScene({
      journal,
      entries,
      session: { cols: 80, rows: 24 },
    });
    const ctx = { cols: 80, rows: 24, colorSupport: "truecolor", done: false } as const;
    scene.enter(ctx);

    scene.handleKey({ type: "char", char: "n" }, ctx);
    for (const ch of "kept through teardown") {
      scene.handleKey({ type: "char", char: ch }, ctx);
    }
    scene.handleKey({ type: "enter" }, ctx);
    await scene.exit();

    const texts: string[] = [];
    for await (const note of journal.streamNotes()) texts.push(note.text);
    expect(texts).toEqual(["kept through teardown"]);
  });
});
