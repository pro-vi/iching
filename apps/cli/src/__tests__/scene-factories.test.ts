// Tests for the typed SceneFactory contract. These pin the exact bug class
// that slipped through Commit C: the dict standalone command had a (id: string)
// factory that would crash at runtime once SceneRouter started passing typed
// SceneSignal objects instead of dotted strings.

import { describe, test, expect, beforeEach, spyOn } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { castOf } from "@iching/core/testing";
import type { ReflectionNote } from "@iching/core";
import { JsonlJournalStore } from "@iching/storage";
import {
  BrowseScene,
  CastScene,
  CellBuffer,
  DetailScene,
  JournalScene,
  type JournalEntryView,
  type SceneContext,
  SceneRouter,
} from "@iching/terminal";
import {
  loadJournalEntries,
  makeBrowseFactory,
  makeDetailScene,
  makeJournalFactory,
  makeJournalScene,
} from "../app/scene-factories.ts";

/** Minimal static journal entry for replay/navigation tests. assembleCast
 *  derives a consistent primary/derived from the lines (hexagram 63, all young),
 *  so an entry round-tripped through the store passes isCastShaped. */
function makeReplayEntry(date: string, timestamp: string): JournalEntryView {
  return {
    date,
    timestamp,
    cast: castOf(63), // 既濟, all young — a static cast
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

  test("the King Wen walk scans the journal ONCE, not per ←/→ keystroke", async () => {
    // ←/→ emits openDetail{replace} per keystroke → a fresh DetailScene each.
    // Before the memo, every step re-streamed + re-parsed the whole history.jsonl
    // (a MAJOR per-keypress cost). The factory now shares one scan across the walk.
    await journal.append({ date: "2026-01-05", cast: castOf(1), timestamp: "2026-01-05T09:00:00.000Z" });
    await journal.append({ date: "2026-02-20", cast: castOf(1), timestamp: "2026-02-20T09:00:00.000Z" });
    await journal.append({ date: "2026-03-28", cast: castOf(1), timestamp: "2026-03-28T09:00:00.000Z" });
    await journal.append({ date: "2026-03-30", cast: castOf(2), timestamp: "2026-03-30T09:00:00.000Z" });

    const streamSpy = spyOn(journal, "stream");
    const factory = makeBrowseFactory({ journal });
    const scene1 = factory({ type: "openDetail", kw: 1 }) as DetailScene; // step 1
    factory({ type: "openDetail", kw: 2 }); // → (walk forward)
    factory({ type: "openDetail", kw: 1 }); // ← (walk back)

    for (let i = 0; i < 50 && scene1.getModel().castCount === 0; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    // Hydration is still correct off the shared scan…
    expect(scene1.getModel().castCount).toBe(3);
    expect(scene1.getModel().lastCastDate).toBe("2026-03-28");
    // …and the three-step walk read the journal exactly once.
    expect(streamSpy).toHaveBeenCalledTimes(1);
    streamSpy.mockRestore();
  });
});

describe("makeDetailScene — journal history hydration", () => {
  const castOf = (primary: number) => ({
    lines: [1, 2, 3, 4, 5, 6].map(() => ({
      value: 7 as const,
      isYang: true,
      isChanging: false,
    })),
    primary,
    becoming: null,
    changingPositions: [],
    nuclear: 1,
    polarity: 2,
    mirror: 1,
    diagonal: 2,
  });

  test("hydrates a hexagram's cast count and last date from the journal", async () => {
    // makeDetailScene fires loadHexagramHistory → setHistory so opening a
    // hexagram ([g] from a reading, or the dictionary) shows "Cast N times
    // (last …)". Only the crash path was pinned; this locks the happy path,
    // so a broken wiring (wrong kw, dropped .then) can't silently blank it.
    const dir = await mkdtemp(join(tmpdir(), "detail-history-test-"));
    const journal = new JsonlJournalStore(join(dir, "history.jsonl"));
    // Three casts of hexagram 1 across different days, plus an unrelated cast.
    await journal.append({ date: "2026-01-05", cast: castOf(1), timestamp: "2026-01-05T09:00:00.000Z" });
    await journal.append({ date: "2026-02-20", cast: castOf(1), timestamp: "2026-02-20T09:00:00.000Z" });
    await journal.append({ date: "2026-03-28", cast: castOf(1), timestamp: "2026-03-28T09:00:00.000Z" });
    await journal.append({ date: "2026-03-30", cast: castOf(2), timestamp: "2026-03-30T09:00:00.000Z" });

    const scene = makeDetailScene(1, { journal });
    // Hydration is async; poll until setHistory lands.
    for (let i = 0; i < 50 && scene.getModel().castCount === 0; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(scene.getModel().castCount).toBe(3); // counts hexagram 1 only, not the 卦 2 cast…
    expect(scene.getModel().lastCastDate).toBe("2026-03-28"); // …and its most recent day
  });

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

describe("loadJournalEntries — read-failure safety", () => {
  test("opens empty and warns when the journal is unreadable, never crashes", async () => {
    // A torn line is skipped per-line inside the stream; a whole-file READ
    // failure (here a directory left at the history path → EISDIR; in the wild
    // a root-owned file → EACCES) would otherwise throw straight through the
    // TUI's openJournal and kill the session. It must open empty with a warning.
    const dir = await mkdtemp(join(tmpdir(), "journal-readfail-test-"));
    const histPath = join(dir, "history.jsonl");
    await mkdir(histPath); // a DIRECTORY where the journal file should be
    const unreadable = new JsonlJournalStore(histPath);

    const errors: string[] = [];
    const origErr = console.error;
    console.error = (...a: unknown[]) => {
      errors.push(a.map(String).join(" "));
    };
    let entries: Awaited<ReturnType<typeof loadJournalEntries>> | undefined;
    try {
      entries = await loadJournalEntries(unreadable);
    } finally {
      console.error = origErr;
    }
    expect(entries).toEqual([]); // opened empty, did not throw…
    expect(errors.join("\n")).toMatch(/couldn't read your journal/i); // …warned honestly
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
    const scene = factory({ type: "openJournalReading", entry: entries[0] });
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
      entry: entries[1], // newest-first index 1 = 2026-01-02, by reference
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
      entry: entries[1],
    });

    // Esc on the list itself pops the router bottom — the home loop resumes.
    expect(list.handleKey({ type: "escape" }, ctx)).toEqual({ type: "back" });
  });

  test("a replayed reading opens settled, not re-animating the cast ritual", () => {
    // The factory calls skipToComplete(false) so reopening a past reading shows
    // it at rest at once — not redrawing line by line the ritual you already
    // watched when you first cast it. Dropping that call still satisfies the
    // scene-type and exit tests above, so pin the settled render directly: the
    // resting footer ([enter] detail) shows, the cast animation's controls
    // ([s] skip / [space] pause) do not.
    const entry: JournalEntryView = {
      date: "2026-01-02",
      timestamp: "2026-01-02T09:00:00.000Z",
      cast: {
        lines: [1, 2, 3, 4, 5, 6].map((p) =>
          p === 1
            ? { value: 9, isYang: true, isChanging: true }
            : { value: 7, isYang: true, isChanging: false },
        ),
        primary: 1,
        becoming: 44,
        changingPositions: [1],
        nuclear: 1,
        polarity: 2,
        mirror: 1,
        diagonal: 2,
      },
    };
    const factory = makeJournalFactory({
      journal,
      entries: [entry],
      session: { cols: 80, rows: 24 },
    });
    const scene = factory({ type: "openJournalReading", entry }) as CastScene;
    const ctx = { cols: 80, rows: 24, colorSupport: "truecolor", done: false } as const;
    const buf = CellBuffer.create(80, 24);
    scene.render(buf, ctx);
    const text = Array.from({ length: 24 }, (_, r) =>
      buf.getRow(r).map((c) => c.char).join(""),
    ).join("\n");
    expect(text).toContain("detail"); // the settled reading's footer…
    expect(text).not.toContain("[s] skip"); // …not the cast animation controls
    expect(text).not.toContain("[space] pause");
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
    await journal.append(makeReplayEntry("2026-01-02", "2026-01-02T09:00:00.000Z"));
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

  test("a note attaches to the reading under the cursor, not the top row", async () => {
    // Three readings on distinct days. The scene sorts most-recent-first, so
    // the cursor's top row is the NEWEST. A note must land on whatever reading
    // the cursor actually sits on — here the OLDEST, two rows down — not
    // silently on the first row. With one entry the wiring can't tell
    // `filtered[cursor]` from `filtered[0]`; this seam needs ≥2 to pin it.
    const days = [
      "2026-01-01T09:00:00.000Z",
      "2026-01-02T09:00:00.000Z",
      "2026-01-03T09:00:00.000Z",
    ];
    for (const ts of days) {
      await journal.append(makeReplayEntry(ts.slice(0, 10), ts));
    }
    const entries = await loadJournalEntries(journal);
    const scene = makeJournalScene({
      journal,
      entries,
      session: { cols: 80, rows: 24 },
    });
    const ctx = { cols: 80, rows: 24, colorSupport: "truecolor", done: false } as const;
    scene.enter(ctx);

    // Walk the cursor down from the newest (top row) to the oldest reading.
    scene.handleKey({ type: "arrow", direction: "down" }, ctx);
    scene.handleKey({ type: "arrow", direction: "down" }, ctx);

    scene.handleKey({ type: "char", char: "n" }, ctx);
    for (const ch of "for the oldest") {
      scene.handleKey({ type: "char", char: ch }, ctx);
    }
    scene.handleKey({ type: "enter" }, ctx);
    await scene.exit();

    // The note's ref points at the oldest reading (the cursor target), not the
    // newest one rendered on the top row.
    const notes = [];
    for await (const note of journal.streamNotes()) notes.push(note);
    expect(notes.map((n) => n.text)).toEqual(["for the oldest"]);
    expect(notes[0].ref).toBe("2026-01-01T09:00:00.000Z");
    expect(notes[0].ref).not.toBe("2026-01-03T09:00:00.000Z");

    // And on reload the note hangs off the oldest reading alone.
    const reloaded = await loadJournalEntries(journal);
    const byTs = (ts: string) => reloaded.find((e) => e.timestamp === ts);
    expect(byTs("2026-01-01T09:00:00.000Z")?.notes.map((n) => n.text)).toEqual([
      "for the oldest",
    ]);
    expect(byTs("2026-01-03T09:00:00.000Z")?.notes ?? []).toEqual([]);
  });
});

describe("makeJournalScene — reflection-note date follows the configured clock", () => {
  test("a committed note is persisted with deps.today, not machine-local", async () => {
    // The post-cast j → journal path (reading-flow) and Home → Journal (main)
    // both thread a timezone-aware `today`; makeJournalScene must stamp the
    // persisted note with it, or a note saved near a timezone boundary lands on
    // the wrong local day and disagrees with the daily anchor. deps.today returns
    // an obviously-non-machine date here.
    let saved: ReflectionNote | undefined;
    const journalStub = {
      skippedLines: 0,
      append: async () => {},
      appendNote: async (n: ReflectionNote) => {
        saved = n;
      },
      stream: async function* () {},
      streamNotes: async function* () {},
      latest: async () => null,
    } as unknown as JsonlJournalStore;

    const scene = makeJournalScene({
      journal: journalStub,
      entries: [makeReplayEntry("2026-03-01", "2026-03-01T08:00:00.000Z")],
      session: { cols: 80, rows: 24 },
      today: () => "2099-12-31",
    });
    const ctx = {
      cols: 80,
      rows: 24,
      done: false,
      colorSupport: "none",
      language: "en",
    } as unknown as SceneContext;
    scene.enter(ctx);
    scene.handleKey({ type: "char", char: "n" }, ctx); // open the note input
    for (const ch of "noted") scene.handleKey({ type: "char", char: ch }, ctx);
    scene.handleKey({ type: "enter" }, ctx); // commit
    await scene.exit(); // drain the in-flight note append

    expect(saved?.date).toBe("2099-12-31"); // the configured today, not machine-local
    expect(saved?.text).toBe("noted");
  });
});
