// JournalScene — reflection notes, incremental search, nav parity,
// dictionary jump, and the patterns pane.

import { describe, test, expect } from "bun:test";
import type { Cast, Line } from "@iching/core";
import { CellBuffer } from "../render/buffer.ts";
import type { SceneContext } from "../scene/types.ts";
import {
  JournalScene,
  entryMatchesQuery,
  type JournalEntryView,
} from "../scenes/journal/journal-scene.ts";
import { computeJournalPatterns } from "../scenes/journal/journal-patterns.ts";

function makeLine(value: 6 | 7 | 8 | 9): Line {
  return {
    value,
    isYang: value === 7 || value === 9,
    isChanging: value === 6 || value === 9,
  };
}

function makeCast(primary: number, becoming: number | null = null, changing: number[] = []): Cast {
  return {
    lines: [makeLine(7), makeLine(8), makeLine(7), makeLine(8), makeLine(7), makeLine(8)],
    primary,
    becoming,
    changingPositions: changing,
    nuclear: 1,
    polarity: 2,
    mirror: 1,
    diagonal: 2,
  };
}

function makeEntry(
  date: string,
  primary: number,
  opts: Partial<JournalEntryView> = {},
): JournalEntryView {
  return { date, cast: makeCast(primary), ...opts };
}

function ctxFor(rows = 24, cols = 80): SceneContext {
  return { cols, rows, colorSupport: "truecolor", language: "en", done: false };
}

function renderText(scene: JournalScene, ctx: SceneContext): string {
  const buf = CellBuffer.create(ctx.cols, ctx.rows);
  scene.render(buf, ctx);
  return Array.from({ length: buf.height }, (_, row) =>
    buf.getRow(row).map((cell) => cell.char).join(""),
  ).join("\n");
}

function press(scene: JournalScene, ctx: SceneContext, ...keys: Array<string>): unknown {
  let last: unknown;
  for (const k of keys) {
    if (k === "enter") last = scene.handleKey({ type: "enter" }, ctx);
    else if (k === "escape") last = scene.handleKey({ type: "escape" }, ctx);
    else if (k === "up" || k === "down") {
      last = scene.handleKey({ type: "arrow", direction: k }, ctx);
    } else if (k === "home" || k === "end") {
      last = scene.handleKey({ type: k }, ctx);
    } else if (k === "backspace") {
      last = scene.handleKey({ type: "backspace" }, ctx);
    } else {
      last = scene.handleKey({ type: "char", char: k }, ctx);
    }
  }
  return last;
}

function type(scene: JournalScene, ctx: SceneContext, text: string): void {
  for (const ch of text) {
    scene.handleKey({ type: "char", char: ch }, ctx);
  }
}

describe("JournalScene nav parity (j/k, home/end)", () => {
  // entries render most recent first: 03-04 (index 0) … 03-01 (index 3)
  const entries = [
    makeEntry("2026-03-01", 1),
    makeEntry("2026-03-02", 2),
    makeEntry("2026-03-03", 3),
    makeEntry("2026-03-04", 4),
  ];

  test("j moves down, k moves up", () => {
    const ctx = ctxFor();
    const scene = new JournalScene(entries);
    scene.enter(ctx);

    press(scene, ctx, "j", "j");
    let signal = press(scene, ctx, "enter");
    expect(signal).toEqual({ type: "openJournalReading", key: "2026-03-02" });

    press(scene, ctx, "k");
    signal = press(scene, ctx, "enter");
    expect(signal).toEqual({ type: "openJournalReading", key: "2026-03-03" });
  });

  test("end jumps to the oldest entry, home back to the newest", () => {
    const ctx = ctxFor();
    const scene = new JournalScene(entries);
    scene.enter(ctx);

    press(scene, ctx, "end");
    expect(press(scene, ctx, "enter")).toEqual({
      type: "openJournalReading",
      key: "2026-03-01",
    });

    press(scene, ctx, "home");
    expect(press(scene, ctx, "enter")).toEqual({
      type: "openJournalReading",
      key: "2026-03-04",
    });
  });

  test("k clamps at the top, j at the bottom", () => {
    const ctx = ctxFor();
    const scene = new JournalScene(entries);
    scene.enter(ctx);

    press(scene, ctx, "k", "k");
    expect(press(scene, ctx, "enter")).toEqual({
      type: "openJournalReading",
      key: "2026-03-04",
    });

    press(scene, ctx, "j", "j", "j", "j", "j", "j");
    expect(press(scene, ctx, "enter")).toEqual({
      type: "openJournalReading",
      key: "2026-03-01",
    });
  });
});

describe("JournalScene search ([/])", () => {
  const entries = [
    makeEntry("2026-03-01", 1, { intention: "the launch question" }),
    makeEntry("2026-03-02", 39), // 蹇 Jiǎn
    makeEntry("2026-03-03", 58, { intention: "about the move" }), // 兌 Duì
  ];

  test("entryMatchesQuery matches intention, names, pinyin, and number", () => {
    expect(entryMatchesQuery(entries[0], "launch")).toBe(true);
    expect(entryMatchesQuery(entries[0], "LAUNCH")).toBe(true);
    expect(entryMatchesQuery(entries[1], "蹇")).toBe(true);
    expect(entryMatchesQuery(entries[1], "jian")).toBe(true); // diacritic-insensitive pinyin
    expect(entryMatchesQuery(entries[1], "39")).toBe(true);
    expect(entryMatchesQuery(entries[1], "launch")).toBe(false);
    expect(entryMatchesQuery(entries[2], "兑")).toBe(true); // simplified form of 兌
    expect(entryMatchesQuery(entries[0], "")).toBe(true);
  });

  test("matches the becoming hexagram too", () => {
    const entry = makeEntry("2026-03-04", 1, { cast: makeCast(1, 39, [2]) });
    expect(entryMatchesQuery(entry, "jian")).toBe(true);
  });

  test("/ activates live filtering; enter opens the filtered selection", () => {
    const ctx = ctxFor();
    const scene = new JournalScene(entries);
    scene.enter(ctx);

    press(scene, ctx, "/");
    type(scene, ctx, "launch");

    const text = renderText(scene, ctx);
    expect(text).toContain("1 readings");
    expect(text).toContain("the launch question");
    expect(text).not.toContain("2026-03-02");

    expect(press(scene, ctx, "enter")).toEqual({
      type: "openJournalReading",
      key: "2026-03-01",
    });
  });

  test("esc clears the search and restores the full list", () => {
    const ctx = ctxFor();
    const scene = new JournalScene(entries);
    scene.enter(ctx);

    press(scene, ctx, "/");
    type(scene, ctx, "jian");
    expect(renderText(scene, ctx)).toContain("1 readings");

    press(scene, ctx, "escape");
    const text = renderText(scene, ctx);
    expect(text).toContain("3 readings");
    // esc with no search active pops the scene
    expect(press(scene, ctx, "escape")).toEqual({ type: "back" });
  });

  test("letter shortcuts become query text while search is live", () => {
    const ctx = ctxFor();
    const scene = new JournalScene(entries);
    scene.enter(ctx);

    press(scene, ctx, "/");
    // n/g/p/q/d must not trigger their normal-mode actions here
    const signal = press(scene, ctx, "n", "g", "p", "q", "d");
    expect(signal).toBeUndefined();
    expect(renderText(scene, ctx)).toContain("0 readings");
  });

  test("footer documents the search key", () => {
    const ctx = ctxFor();
    const scene = new JournalScene(entries);
    scene.enter(ctx);
    expect(renderText(scene, ctx)).toContain("[/] search");
  });
});

describe("JournalScene reflection notes ([n])", () => {
  test("n + text + enter commits the note and notifies onNote", () => {
    const ctx = ctxFor();
    const entries = [makeEntry("2026-03-01", 1, { timestamp: "2026-03-01T08:00:00.000Z" })];
    const committed: Array<{ key: string; text: string }> = [];
    const scene = new JournalScene(entries, {
      today: () => "2026-03-05",
      onNote: (entry, text) => {
        committed.push({ key: entry.timestamp ?? entry.date, text });
      },
    });
    scene.enter(ctx);

    press(scene, ctx, "n");
    type(scene, ctx, "it resolved itself");
    press(scene, ctx, "enter");

    expect(committed).toEqual([
      { key: "2026-03-01T08:00:00.000Z", text: "it resolved itself" },
    ]);
    // The view updates immediately: marker on the row, note in the preview
    const text = renderText(scene, ctx);
    expect(text).toContain("·note");
    expect(text).toContain("2026-03-05  it resolved itself");
  });

  test("esc cancels without committing; empty enter is a cancel", () => {
    const ctx = ctxFor();
    const entries = [makeEntry("2026-03-01", 1)];
    let called = 0;
    const scene = new JournalScene(entries, { onNote: () => called++ });
    scene.enter(ctx);

    press(scene, ctx, "n");
    type(scene, ctx, "half a thought");
    press(scene, ctx, "escape");
    expect(called).toBe(0);
    expect(renderText(scene, ctx)).not.toContain("·note");

    press(scene, ctx, "n");
    press(scene, ctx, "enter"); // nothing typed
    expect(called).toBe(0);
  });

  test("note input renders prompt and captures nav letters as text", () => {
    const ctx = ctxFor();
    const entries = [makeEntry("2026-03-01", 1)];
    const scene = new JournalScene(entries, { today: () => "2026-03-05" });
    scene.enter(ctx);

    press(scene, ctx, "n");
    expect(renderText(scene, ctx)).toContain("Note: ");
    // j/k/q/p are text while the input is live, not navigation
    const signal = press(scene, ctx, "j", "k", "q", "p");
    expect(signal).toBeUndefined();
    press(scene, ctx, "enter");
    expect(renderText(scene, ctx)).toContain("jkqp");
  });

  test("pasted note text folds newlines and strips control chars", () => {
    const ctx = ctxFor();
    const entries = [makeEntry("2026-03-01", 1)];
    const texts: string[] = [];
    const scene = new JournalScene(entries, {
      today: () => "2026-03-05",
      onNote: (_e, t) => texts.push(t),
    });
    scene.enter(ctx);

    press(scene, ctx, "n");
    scene.handleKey({ type: "paste", text: "line one\nline two\x07" }, ctx);
    press(scene, ctx, "enter");
    expect(texts).toEqual(["line one line two"]);
  });

  test("annotated entries keep their marker in the list", () => {
    const ctx = ctxFor();
    const entries = [
      makeEntry("2026-03-01", 1, { notes: [{ text: "already noted", date: "2026-03-02" }] }),
      makeEntry("2026-03-03", 2),
    ];
    const scene = new JournalScene(entries);
    scene.enter(ctx);

    const text = renderText(scene, ctx);
    expect(text).toContain("·note");
    // The selected entry (most recent, no notes) previews its image text,
    // not the other entry's note.
    expect(text).not.toContain("already noted");

    press(scene, ctx, "j");
    expect(renderText(scene, ctx)).toContain("2026-03-02  already noted");
  });
});

describe("JournalScene dictionary jump ([g])", () => {
  test("g opens the entry's primary detail with its changing positions", () => {
    const ctx = ctxFor();
    const entries = [makeEntry("2026-03-01", 21, { cast: makeCast(21, 42, [1, 4]) })];
    const scene = new JournalScene(entries);
    scene.enter(ctx);

    expect(press(scene, ctx, "g")).toEqual({
      type: "openDetail",
      kw: 21,
      changedPositions: [1, 4],
    });
  });

  test("g without moving lines opens detail without cast context", () => {
    const ctx = ctxFor();
    const entries = [makeEntry("2026-03-01", 2)];
    const scene = new JournalScene(entries);
    scene.enter(ctx);

    expect(press(scene, ctx, "g")).toEqual({ type: "openDetail", kw: 2 });
  });

  test("d still opens the generic dictionary", () => {
    const ctx = ctxFor();
    const scene = new JournalScene([makeEntry("2026-03-01", 1)]);
    scene.enter(ctx);
    expect(press(scene, ctx, "d")).toEqual({ type: "openDictionary" });
  });
});

describe("JournalScene patterns pane ([p])", () => {
  const entries = [
    makeEntry("2026-03-01", 39, { cast: makeCast(39, 8, [5]) }),
    makeEntry("2026-03-08", 39, { cast: makeCast(39, 15, [5]) }),
    makeEntry("2026-03-20", 1),
    makeEntry("2026-04-02", 39),
  ];

  test("p toggles a quiet observatory over the loaded entries", () => {
    const ctx = ctxFor();
    const scene = new JournalScene(entries, { today: () => "2026-04-15" });
    scene.enter(ctx);

    press(scene, ctx, "p");
    const text = renderText(scene, ctx);
    expect(text).toContain("Patterns");
    expect(text).toContain("4 readings");
    expect(text).toContain("this month 1");
    expect(text).toContain("most seen");
    expect(text).toContain("蹇 (Jiǎn)   ×3 · 2026-04-02");
    expect(text).toContain("moving line most often · 5 (×2)");

    // esc closes the pane (does not pop the scene)
    const signal = press(scene, ctx, "escape");
    expect(signal).toBeUndefined();
    expect(renderText(scene, ctx)).not.toContain("most seen");
  });

  test("p closes the pane too, and list keys are inert while it is open", () => {
    const ctx = ctxFor();
    const scene = new JournalScene(entries, { today: () => "2026-04-15" });
    scene.enter(ctx);

    press(scene, ctx, "p");
    expect(press(scene, ctx, "n", "g", "enter")).toBeUndefined();
    press(scene, ctx, "p");
    expect(renderText(scene, ctx)).not.toContain("most seen");
  });
});

describe("computeJournalPatterns", () => {
  test("derives totals, month count, frequency, and moving-line mode", () => {
    const entries = [
      makeEntry("2026-03-01", 39, { cast: makeCast(39, 8, [5, 2]) }),
      makeEntry("2026-03-08", 39, { cast: makeCast(39, 15, [5]) }),
      makeEntry("2026-04-02", 1),
    ];
    const p = computeJournalPatterns(entries, "2026-04-15");
    expect(p.total).toBe(3);
    expect(p.thisMonth).toBe(1);
    expect(p.topHexagrams[0]).toEqual({ kw: 39, count: 2, lastDate: "2026-03-08" });
    expect(p.topHexagrams[1]).toEqual({ kw: 1, count: 1, lastDate: "2026-04-02" });
    expect(p.movingLine).toEqual({ position: 5, count: 2 });
  });

  test("empty journal and no moving lines stay calm", () => {
    expect(computeJournalPatterns([], "2026-04-15")).toEqual({
      total: 0,
      thisMonth: 0,
      topHexagrams: [],
      movingLine: null,
    });
    const p = computeJournalPatterns([makeEntry("2026-04-01", 2)], "2026-04-15");
    expect(p.movingLine).toBeNull();
  });

  test("frequency ties break by lower KW; top list caps at five", () => {
    const entries = [1, 2, 3, 4, 5, 6, 6].map((kw, i) =>
      makeEntry(`2026-03-0${i + 1}`, kw),
    );
    const p = computeJournalPatterns(entries, "2026-04-15");
    expect(p.topHexagrams).toHaveLength(5);
    expect(p.topHexagrams[0].kw).toBe(6);
    expect(p.topHexagrams.slice(1).map((h) => h.kw)).toEqual([1, 2, 3, 4]);
  });
});
