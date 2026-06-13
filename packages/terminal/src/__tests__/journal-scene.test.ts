// JournalScene — reflection notes, incremental search, nav parity,
// dictionary jump, and the patterns pane.

import { describe, test, expect } from "bun:test";
import type { Cast, Line } from "@iching/core";
import { CellBuffer } from "../render/buffer.ts";
import { stringWidth } from "../layout/measure.ts";
import type { SceneContext } from "../scene/types.ts";
import {
  JournalScene,
  entryMatchesQuery,
  sanitizeFieldText,
  truncateToWidth,
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
    lines: [1, 2, 3, 4, 5, 6].map((pos) =>
      changing.includes(pos)
        ? makeLine(pos % 2 === 0 ? 6 : 9)
        : makeLine(pos % 2 === 0 ? 8 : 7),
    ),
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

  test("pasted search text strips C1 controls before filtering", () => {
    const ctx = ctxFor();
    const scene = new JournalScene(entries);
    scene.enter(ctx);

    press(scene, ctx, "/");
    // A C1 byte inside the pasted query must not poison the filter.
    scene.handleKey({ type: "paste", text: "lau\u009bnch" }, ctx);
    const text = renderText(scene, ctx);
    expect(text).toContain("1 readings");
    expect(text).toContain("the launch question");
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
    const scene = new JournalScene(entries, {
      onNote: () => {
        called++;
      },
    });
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
      onNote: (_e, t) => {
        texts.push(t);
      },
    });
    scene.enter(ctx);

    press(scene, ctx, "n");
    scene.handleKey({ type: "paste", text: "line one\nline two\x07" }, ctx);
    press(scene, ctx, "enter");
    expect(texts).toEqual(["line one line two"]);
  });

  test("pasted note text strips C1 controls and raw ESC, not just C0", () => {
    const ctx = ctxFor();
    const entries = [makeEntry("2026-03-01", 1)];
    const texts: string[] = [];
    const scene = new JournalScene(entries, {
      today: () => "2026-03-05",
      onNote: (_e, t) => {
        texts.push(t);
      },
    });
    scene.enter(ctx);

    press(scene, ctx, "n");
    // \x1b (ESC) and the C1 controls \x85 (NEL) / \u009b (CSI) must all be
    // stripped — the printable remainder of an ANSI sequence stays as text.
    scene.handleKey({ type: "paste", text: "before\x1b[31m after\x85\u009btail" }, ctx);
    press(scene, ctx, "enter");
    expect(texts).toEqual(["before[31m aftertail"]);
  });

  test("a decoded C1 control arriving as a char event is dropped", () => {
    const ctx = ctxFor();
    const entries = [makeEntry("2026-03-01", 1)];
    const texts: string[] = [];
    const scene = new JournalScene(entries, {
      today: () => "2026-03-05",
      onNote: (_e, t) => {
        texts.push(t);
      },
    });
    scene.enter(ctx);

    press(scene, ctx, "n");
    scene.handleKey({ type: "char", char: "\u0085" }, ctx);
    type(scene, ctx, "ok");
    press(scene, ctx, "enter");
    expect(texts).toEqual(["ok"]);
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

describe("JournalScene note persistence honesty", () => {
  /** The preview row's first written cell (row rows-2, col 2). */
  function previewCell(scene: JournalScene, ctx: SceneContext) {
    const buf = CellBuffer.create(ctx.cols, ctx.rows);
    scene.render(buf, ctx);
    return buf.getCell(ctx.rows - 2, 2);
  }

  test("a promise-backed note renders dim while pending, settles to saved", async () => {
    const ctx = ctxFor();
    const entries = [makeEntry("2026-03-01", 1)];
    let resolveSave!: () => void;
    const scene = new JournalScene(entries, {
      today: () => "2026-03-05",
      onNote: () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    });
    scene.enter(ctx);

    press(scene, ctx, "n");
    type(scene, ctx, "still in flight");
    press(scene, ctx, "enter");

    // Pending: visible immediately, but dim — not yet presented as durable.
    expect(renderText(scene, ctx)).toContain("still in flight");
    expect(previewCell(scene, ctx).dim).toBe(true);

    resolveSave();
    await scene.notesSettled();
    expect(renderText(scene, ctx)).toContain("still in flight");
    expect(previewCell(scene, ctx).dim ?? false).toBe(false);
  });

  test("a failed append withdraws the marker and shows one calm line", async () => {
    const ctx = ctxFor();
    const entries = [makeEntry("2026-03-01", 1)];
    const scene = new JournalScene(entries, {
      today: () => "2026-03-05",
      onNote: () => Promise.reject(new Error("ENOSPC")),
    });
    scene.enter(ctx);

    press(scene, ctx, "n");
    type(scene, ctx, "lost to the disk");
    press(scene, ctx, "enter");
    await scene.notesSettled();

    const text = renderText(scene, ctx);
    expect(text).not.toContain("·note");
    expect(text).not.toContain("lost to the disk");
    expect(text).toContain("the note could not be saved");
    expect(previewCell(scene, ctx).dim).toBe(true);
  });

  test("a retried note clears the failure line on success", async () => {
    const ctx = ctxFor();
    const entries = [makeEntry("2026-03-01", 1)];
    let fail = true;
    const scene = new JournalScene(entries, {
      today: () => "2026-03-05",
      onNote: () => (fail ? Promise.reject(new Error("EACCES")) : Promise.resolve()),
    });
    scene.enter(ctx);

    press(scene, ctx, "n");
    type(scene, ctx, "first try");
    press(scene, ctx, "enter");
    await scene.notesSettled();
    expect(renderText(scene, ctx)).toContain("the note could not be saved");

    fail = false;
    press(scene, ctx, "n");
    type(scene, ctx, "second try");
    press(scene, ctx, "enter");
    await scene.notesSettled();

    const text = renderText(scene, ctx);
    expect(text).not.toContain("the note could not be saved");
    expect(text).toContain("second try");
    expect(text).toContain("·note");
  });

  test("exit() awaits in-flight appends so teardown cannot lose the write", async () => {
    const ctx = ctxFor();
    const entries = [makeEntry("2026-03-01", 1)];
    let landed = false;
    const scene = new JournalScene(entries, {
      today: () => "2026-03-05",
      onNote: () =>
        new Promise<void>((resolve) =>
          setTimeout(() => {
            landed = true;
            resolve();
          }, 15),
        ),
    });
    scene.enter(ctx);

    press(scene, ctx, "n");
    type(scene, ctx, "enter then leave");
    press(scene, ctx, "enter");
    // esc right after committing — the scene is being torn down.
    expect(press(scene, ctx, "escape")).toEqual({ type: "back" });

    await scene.exit();
    expect(landed).toBe(true);
  });

  test("a synchronous onNote is saved immediately (no pending dim)", () => {
    const ctx = ctxFor();
    const entries = [makeEntry("2026-03-01", 1)];
    const scene = new JournalScene(entries, {
      today: () => "2026-03-05",
      onNote: () => {},
    });
    scene.enter(ctx);

    press(scene, ctx, "n");
    type(scene, ctx, "sync save");
    press(scene, ctx, "enter");
    expect(previewCell(scene, ctx).dim ?? false).toBe(false);
  });
});

describe("JournalScene page up/down keeps the selection visible", () => {
  // 30 entries, newest first after reversal: index 0 = 2026-01-30.
  const entries = Array.from({ length: 30 }, (_, i) =>
    makeEntry(`2026-01-${String(i + 1).padStart(2, "0")}`, (i % 64) + 1),
  );

  test("pageDown lands the cursor inside the rendered window", () => {
    const ctx = ctxFor(10, 80); // viewport = rows - 4 = 6
    const scene = new JournalScene(entries);
    scene.enter(ctx);

    // One page down: cursor 0 → 6 (entry 2026-01-24). The ScrollableRegion
    // holds no content lines, so without ensureCursorVisible the offset
    // stayed 0 and the selected row left the viewport entirely.
    scene.handleKey({ type: "page", direction: "down" }, ctx);
    expect(renderText(scene, ctx)).toMatch(/ > .*2026-01-24/);

    // A second page keeps tracking.
    scene.handleKey({ type: "page", direction: "down" }, ctx);
    expect(renderText(scene, ctx)).toMatch(/ > .*2026-01-18/);
  });

  test("pageUp from the end scrolls the selection back into view", () => {
    const ctx = ctxFor(10, 80);
    const scene = new JournalScene(entries);
    scene.enter(ctx);

    press(scene, ctx, "end"); // cursor 29 → 2026-01-01
    expect(renderText(scene, ctx)).toMatch(/ > .*2026-01-01/);

    scene.handleKey({ type: "page", direction: "up" }, ctx);
    expect(renderText(scene, ctx)).toMatch(/ > .*2026-01-07/);
  });

  test("pageDown clamps at the last entry and stays visible", () => {
    const ctx = ctxFor(10, 80);
    const scene = new JournalScene(entries);
    scene.enter(ctx);

    for (let i = 0; i < 10; i++) {
      scene.handleKey({ type: "page", direction: "down" }, ctx);
    }
    expect(renderText(scene, ctx)).toMatch(/ > .*2026-01-01/);
  });
});

describe("sanitizeFieldText", () => {
  test("folds newlines/tabs and strips C0, DEL, C1, and ESC", () => {
    expect(sanitizeFieldText("a\nb\tc")).toBe("a b c");
    expect(sanitizeFieldText("a\x07b\x7fc")).toBe("abc");
    expect(sanitizeFieldText("a\x1b[2Jb")).toBe("a[2Jb");
    expect(sanitizeFieldText("a\u0085b\u009bc\u0090d")).toBe("abcd");
    expect(sanitizeFieldText("漢字 ok")).toBe("漢字 ok");
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
    makeEntry("2026-03-01", 39, { cast: makeCast(39, 8, [5]), method: "coin" }),
    makeEntry("2026-03-08", 39, { cast: makeCast(39, 15, [5]), method: "yarrow" }),
    makeEntry("2026-03-20", 1),
    makeEntry("2026-04-02", 39, { method: "coin-manual" }),
  ];

  test("p opens the field of sixty-four with ruled sections", () => {
    const ctx = ctxFor(45, 80);
    const scene = new JournalScene(entries, { today: () => "2026-04-15" });
    scene.enter(ctx);

    press(scene, ctx, "p");
    const text = renderText(scene, ctx);

    // S1 — the field: every glyph present, day facts annotate it, legend below
    expect(text).toContain("觀象 · patterns");
    expect(text).toContain("䷀");
    expect(text).toContain("䷿");
    expect(text).toContain("4 readings · 33d · active days 4");
    expect(text).toContain("seen 2 of 64");
    expect(text).toContain("recurrence ×2");
    expect(text).toContain("this month 1 · 30d 2 · idle 13d");
    expect(text).toContain("coin 2 · yarrow 1 · unmarked 1");
    expect(text).toContain("○ not yet  ◦ once  ◐ a few  ● often");

    // 3 method-marked readings < 8: observed-vs-chance is withheld, honestly.
    expect(text).toContain("too few readings yet to weigh against chance");
    expect(text).not.toContain("by chance");

    // S2 — faces seen: aligned labels, bars, counts, last dates
    expect(text).toContain("卦象 · faces seen");
    expect(text).toContain("䷦ 蹇 Jiǎn");
    expect(text).toContain("▅▅▅▅▅▅▅▅▅▅▅▅ ×3 · last 04-02");
    expect(text).toContain("䷀ 乾 Qián");

    // S3 — movement, read top-down like a hexagram
    expect(text).toContain("爻象 · where movement falls");
    expect(text).toContain("line 5 · 五");
    expect(text).toContain("× 2");
    expect(text).toContain("moved per cast");
    expect(text).toContain("0 ×2");
    expect(text).toContain("1 ×2");

    // S4 — trigrams with upper/lower roles (坎 is 蹇's upper trigram, 3 casts)
    expect(text).toContain("八卦 · trigrams");
    expect(text).toContain("☵ 坎 water");
    expect(text).toContain("upper/lower 3/0");

    // S5 — succession drift sparkline (no transition repeats in this fixture)
    expect(text).toContain("次第 · one cast to the next");
    expect(text).toContain("cast to cast");
    expect(text).toContain("lines differing");

    // S6 — turnings & echoes (every fixture cast shares nuclear/polarity/mirror)
    expect(text).toContain("卦變 · turnings & echoes");
    expect(text).toContain("nuclear");
    expect(text).toContain("䷀ 乾 Qián ×4");

    expect(text).toContain("[↑↓] scroll");

    // esc closes the pane (does not pop the scene)
    const signal = press(scene, ctx, "escape");
    expect(signal).toBeUndefined();
    expect(renderText(scene, ctx)).not.toContain("卦象");
  });

  test("p closes the pane too, and list keys are inert while it is open", () => {
    const ctx = ctxFor();
    const scene = new JournalScene(entries, { today: () => "2026-04-15" });
    scene.enter(ctx);

    press(scene, ctx, "p");
    expect(press(scene, ctx, "n", "g", "enter")).toBeUndefined();
    press(scene, ctx, "p");
    expect(renderText(scene, ctx)).not.toContain("卦象");
  });

  test("patterns pane scrolls through overflow and resets when closed", () => {
    const ctx = ctxFor(10, 80);
    const scene = new JournalScene(entries, { today: () => "2026-04-15" });
    scene.enter(ctx);

    // 36 content rows over a 5-row viewport: 8 pages.
    press(scene, ctx, "p");
    let text = renderText(scene, ctx);
    expect(text).toContain("觀象 · patterns");
    expect(text).toContain("1/8");
    expect(text).not.toContain("卦象 · faces seen");

    scene.handleKey({ type: "page", direction: "down" }, ctx);
    text = renderText(scene, ctx);
    expect(text).toContain("2/8");

    scene.handleKey({ type: "end" }, ctx);
    text = renderText(scene, ctx);
    expect(text).toContain("兩儀 · two modes"); // the bottom coda
    expect(text).toContain("yin 12 · yang 12");
    // End reaches the true last page (the fixed free-scroll indicator), not 7/8.
    expect(text).toContain("8/8");

    scene.handleKey({ type: "home" }, ctx);
    expect(renderText(scene, ctx)).toContain("觀象 · patterns");

    press(scene, ctx, "p"); // close and reset
    press(scene, ctx, "p"); // reopen
    text = renderText(scene, ctx);
    expect(text).toContain("觀象 · patterns");
    expect(text).toContain("1/8");
  });

  test("every row fits the column budget — no ellipsis at 80 or 100 cols", () => {
    // A gate-on journal (8+ method-marked casts) exercises the widest rows:
    // chance clauses, old-line rows, last dates, and the bin chance table.
    const rich = [
      makeEntry("2026-03-01", 61, { cast: makeCast(61, 62, [1, 4]), method: "coin" }),
      makeEntry("2026-03-02", 61, { cast: makeCast(61, 8, [5]), method: "coin" }),
      makeEntry("2026-03-05", 62, { cast: makeCast(62, 61, [2, 3, 6]), method: "yarrow" }),
      makeEntry("2026-03-09", 64, { cast: makeCast(64, 63, [1, 2, 3, 4, 5, 6]), method: "coin" }),
      makeEntry("2026-03-12", 14, { cast: makeCast(14, 1, [5]), method: "yarrow" }),
      makeEntry("2026-03-15", 61, { cast: makeCast(61, 62, [1, 4]), method: "coin-manual" }),
      makeEntry("2026-03-20", 1, { cast: makeCast(1, 2, [1, 2, 3, 4, 5, 6]), method: "coin" }),
      makeEntry("2026-03-25", 64, { cast: makeCast(64, 50, [3]), method: "yarrow-manual" }),
      // 大壯 (KW 34) — 「䷡ 大壯 Dà Zhuàng」 is the widest en faces label (17 cols);
      // it must appear in the top-5 faces so the label-column sweep covers it.
      makeEntry("2026-03-28", 34, { cast: makeCast(34, 1, [2]), method: "coin" }),
      makeEntry("2026-03-29", 34, { cast: makeCast(34, 5, [4]), method: "yarrow" }),
      makeEntry("2026-04-01", 61, { method: "coin" }),
    ];
    const gateMarks = {
      en: ["by chance", "old yang"],
      "zh-Hant": ["理數約", "老陽九"],
      "zh-Hans": ["理数约", "老阳九"],
    } as const;
    for (const cols of [80, 100]) {
      for (const language of ["en", "zh-Hant", "zh-Hans"] as const) {
        const ctx: SceneContext = { cols, rows: 50, colorSupport: "truecolor", language, done: false };
        const scene = new JournalScene(rich, { today: () => "2026-04-15" });
        scene.enter(ctx);
        press(scene, ctx, "p");
        const text = renderText(scene, ctx);
        // 大壯 (Dà Zhuàng, KW 34) is the widest en label (17 cols); the gate is on.
        for (const mark of gateMarks[language]) expect(text).toContain(mark);
        if (language === "en") expect(text).toContain("大壯 Dà Zhuàng");
        // An ellipsis means a row crossed the budget and was clipped.
        expect(text).not.toContain("…");
      }
    }
  });

  test("recurrence counts all readings, not just method-marked ones", () => {
    // 10 legacy (unmarked) casts, kw1 ×7 + kw2 ×3 — 8 real repeats, 0 marked.
    // The known-only repeat tally would read ×0 while the field/faces show the
    // recurrence plainly; the pane must agree with itself.
    const legacy = [1, 1, 1, 1, 1, 1, 1, 2, 2, 2].map((kw, i) =>
      makeEntry(`2026-05-${String(i + 1).padStart(2, "0")}`, kw),
    );
    const ctx = ctxFor(40, 100);
    const scene = new JournalScene(legacy, { today: () => "2026-05-20" });
    scene.enter(ctx);
    press(scene, ctx, "p");
    const text = renderText(scene, ctx);
    expect(text).toContain("recurrence ×8");
    expect(text).not.toContain("recurrence ×0");
    // No method baseline → no baseline chance clause (those render with a
    // '· by chance' joiner), and the footnote says why. The 八卦 note is
    // method-free geometry ('each by chance'), so it may still appear.
    expect(text).toContain("legacy entries only; baseline held back");
    expect(text).not.toContain("· by chance");
    expect(text).not.toContain("old yang");
  });

  test("bars render in the lower-block ink family — ▅ fill, ▁ groove track", () => {
    // line 5 moves 4×, line 4 moves 5× (the max). Bars round to whole cells in
    // the ▅/▁ family that the drift sparkline shares; the max fills solid.
    const moving = [
      makeEntry("2026-03-01", 2, { cast: makeCast(2, 24, [4]), method: "coin" }),
      makeEntry("2026-03-02", 2, { cast: makeCast(2, 24, [4]), method: "coin" }),
      makeEntry("2026-03-03", 2, { cast: makeCast(2, 24, [4]), method: "coin" }),
      makeEntry("2026-03-04", 2, { cast: makeCast(2, 24, [4]), method: "coin" }),
      makeEntry("2026-03-05", 2, { cast: makeCast(2, 24, [4]), method: "coin" }),
      makeEntry("2026-03-06", 2, { cast: makeCast(2, 7, [5]), method: "coin" }),
      makeEntry("2026-03-07", 2, { cast: makeCast(2, 7, [5]), method: "coin" }),
      makeEntry("2026-03-08", 2, { cast: makeCast(2, 7, [5]), method: "coin" }),
      makeEntry("2026-03-09", 2, { cast: makeCast(2, 7, [5]), method: "coin" }),
    ];
    const ctx = ctxFor(40, 80);
    const scene = new JournalScene(moving, { today: () => "2026-04-15" });
    scene.enter(ctx);
    press(scene, ctx, "p");
    const text = renderText(scene, ctx);
    expect(text).toContain("▅▅▅▅▅▅▅▅▅▅▁▁"); // line 5: 4/5 of 12 → 10 ink + 2 groove
    expect(text).toContain("▅▅▅▅▅▅▅▅▅▅▅▅ × 5"); // line 4 (the max) fills solid
  });

  test("the patterns derivation is memoized but recomputes when the day rolls over", () => {
    // The 30 FPS loop re-renders the open pane continuously; the derivation is
    // cached so it isn't rebuilt every frame, but the cache is keyed on `today`
    // so a midnight rollover (idle days, this-month) stays correct.
    let today = "2026-04-15";
    const scene = new JournalScene([makeEntry("2026-04-10", 1, { method: "coin" })], {
      today: () => today,
    });
    const ctx = ctxFor(45, 80);
    scene.enter(ctx);
    press(scene, ctx, "p");
    expect(renderText(scene, ctx)).toContain("idle 5d"); // 04-15 − 04-10
    // Re-rendering the same day must not change anything (served from cache)…
    expect(renderText(scene, ctx)).toContain("idle 5d");
    // …but a new day recomputes the day-relative figures.
    today = "2026-04-20";
    expect(renderText(scene, ctx)).toContain("idle 10d"); // 04-20 − 04-10
  });

  test("the field marks the most recent reading with accent on the glyph itself", () => {
    const { getTheme } = require("../color/theme.ts");
    const accent = getTheme().accent;
    const entries = [
      makeEntry("2026-03-01", 39, { method: "coin" }),
      makeEntry("2026-03-08", 12, { method: "coin" }),
      makeEntry("2026-04-02", 1, { method: "coin" }), // most recent → 乾 (kw1, glyph ䷀)
    ];
    const ctx = ctxFor(45, 80);
    const scene = new JournalScene(entries, { today: () => "2026-04-15" });
    scene.enter(ctx);
    press(scene, ctx, "p");
    const buf = CellBuffer.create(ctx.cols, ctx.rows);
    scene.render(buf, ctx);
    // Collect every hexagram glyph cell rendered in the accent tone.
    const accented: string[] = [];
    for (let r = 0; r < buf.height; r++) {
      for (const cell of buf.getRow(r)) {
        const code = cell.char.codePointAt(0) ?? 0;
        if (code >= 0x4dc0 && code <= 0x4dff && cell.fg === accent) accented.push(cell.char);
      }
    }
    // Exactly one hexagram glyph is accented — the most recent (䷀, kw1).
    expect(accented).toEqual(["䷀"]);
    // And the legend teaches the channel.
    const text = renderText(scene, ctx);
    expect(text).toContain("◉");
    expect(text).toContain("now");
  });

  test("section rules hinge with ┄ and set notes flush-right as margin whispers", () => {
    const ctx = ctxFor(45, 80);
    const scene = new JournalScene(
      [
        makeEntry("2026-03-01", 61, { cast: makeCast(61, 8, [5]), method: "coin" }),
        makeEntry("2026-03-02", 62, { cast: makeCast(62, 7, [2]), method: "coin" }),
        makeEntry("2026-03-03", 1, { cast: makeCast(1, 2, [3]), method: "yarrow" }),
        makeEntry("2026-03-04", 2, { cast: makeCast(2, 1, [4]), method: "yarrow" }),
        makeEntry("2026-03-05", 14, { cast: makeCast(14, 1, [1]), method: "coin" }),
        makeEntry("2026-03-06", 50, { cast: makeCast(50, 1, [6]), method: "coin" }),
        makeEntry("2026-03-07", 11, { cast: makeCast(11, 1, [2]), method: "yarrow" }),
        makeEntry("2026-03-08", 12, { cast: makeCast(12, 1, [3]), method: "coin" }),
      ],
      { today: () => "2026-04-15" },
    );
    scene.enter(ctx);
    press(scene, ctx, "p");
    const lines = renderText(scene, ctx).split("\n");
    const faces = lines.find((l) => l.includes("卦象 · faces seen")) ?? "";
    // The title hands off to the rule via a ┄ hinge…
    expect(faces).toContain("卦象 · faces seen ┄");
    // …and the note ends the line unboxed (no trailing ' ──' box).
    expect(faces.trimEnd()).toMatch(/each by chance ~[\d.]+$/);
    expect(faces).not.toContain("~0.1 ──");
  });

  test("兩儀 coda renders the yang/yin balance growing from a central axis", () => {
    // 8 all-yang casts (乾) + 3 all-yin casts (坤): 48 yang, 18 yin lines.
    const allYang = (): Cast => ({
      lines: [1, 2, 3, 4, 5, 6].map(() => makeLine(7)),
      primary: 1, becoming: null, changingPositions: [], nuclear: 1, polarity: 2, mirror: 1, diagonal: 2,
    });
    const allYin = (): Cast => ({
      lines: [1, 2, 3, 4, 5, 6].map(() => makeLine(8)),
      primary: 2, becoming: null, changingPositions: [], nuclear: 1, polarity: 2, mirror: 1, diagonal: 2,
    });
    const entries = [
      ...Array.from({ length: 8 }, (_, i) => makeEntry(`2026-03-0${i + 1}`, 1, { cast: allYang() })),
      ...Array.from({ length: 3 }, (_, i) => makeEntry(`2026-03-1${i + 1}`, 2, { cast: allYin() })),
    ];
    const ctx = ctxFor(45, 80);
    const scene = new JournalScene(entries, { today: () => "2026-04-15" });
    scene.enter(ctx);
    press(scene, ctx, "p");
    const text = renderText(scene, ctx);
    expect(text).toContain("兩儀 · two modes");
    expect(text).toContain("yin 18 · yang 48");
    expect(text).toContain("│"); // the still central axis
    expect(text).toContain("⚋");
    expect(text).toContain("⚊");
  });

  test("narrow terminals reflow the field annotations below the grid", () => {
    const ctx = ctxFor(40, 60);
    const scene = new JournalScene(entries, { today: () => "2026-04-15" });
    scene.enter(ctx);

    press(scene, ctx, "p");
    const text = renderText(scene, ctx);
    const lines = text.split("\n");
    const gridLine = lines.findIndex((line) => line.includes("䷀"));
    // 'active days' lives in the a1 annotation, never the journal header.
    const factsLine = lines.findIndex((line) => line.includes("active days 4"));
    expect(gridLine).toBeGreaterThanOrEqual(0);
    // Facts reflow beneath the grid instead of clipping beside it…
    expect(factsLine).toBeGreaterThan(gridLine + 7);
    // …and the most expendable spans (last dates) are dropped outright.
    expect(text).not.toContain("last 0");
    expect(text).not.toContain("…");
  });
});

describe("truncateToWidth", () => {
  test("returns strings within budget unchanged", () => {
    expect(truncateToWidth("short", 30)).toBe("short");
    expect(truncateToWidth("漢字", 4)).toBe("漢字");
  });

  test("truncates Latin text to budget with a one-column ellipsis", () => {
    expect(truncateToWidth("abcdef", 5)).toBe("abcd…");
    expect(stringWidth(truncateToWidth("abcdef", 5))).toBe(5);
  });

  test("truncates CJK text by display width, not code units", () => {
    // 漢字漢字 is 4 code units but 8 columns.
    expect(truncateToWidth("漢字漢字", 5)).toBe("漢字…");
    // A wide char that would straddle the budget is dropped, not split.
    expect(truncateToWidth("漢字漢字", 6)).toBe("漢字…");
    expect(stringWidth(truncateToWidth("漢字漢字", 6))).toBeLessThanOrEqual(6);
  });

  test("degenerate budgets stay safe", () => {
    expect(truncateToWidth("漢字", 0)).toBe("");
    expect(truncateToWidth("漢字", 1)).toBe("…");
  });
});

describe("JournalScene CJK display-width truncation", () => {
  // 21 CJK characters — 42 columns, well past the 30-column intention budget.
  const cjkIntention = "關於工作的問題與未來方向的一次深長思考啊";

  test("intention preview truncates by display width, not code units", () => {
    const ctx = ctxFor(24, 80);
    const scene = new JournalScene([
      makeEntry("2026-03-01", 1, { intention: cjkIntention }),
    ]);
    scene.enter(ctx);

    // Code-unit slicing kept 29 CJK chars (58 columns) and ran the row off
    // the right edge — the closing quote never rendered at 80 cols.
    const text = renderText(scene, ctx);
    const m = text.match(/“([^”\n]*)”/);
    expect(m).not.toBeNull();
    expect(m![1]!.endsWith("…")).toBe(true);
    expect(stringWidth(m![1]!)).toBeLessThanOrEqual(30);
  });

  test("row line truncates to the viewport with a visible ellipsis", () => {
    const ctx = ctxFor(24, 40);
    const scene = new JournalScene([
      makeEntry("2026-03-01", 1, { intention: cjkIntention }),
    ]);
    scene.enter(ctx);

    const buf = CellBuffer.create(ctx.cols, ctx.rows);
    scene.render(buf, ctx);
    const painted = buf.getRow(2).map((c) => c.char).join("").trimEnd();
    // The ellipsis must be on screen (code-unit slicing pushed it past the
    // edge, where writeText clipped it) and the row must fit its columns.
    expect(painted.endsWith("…")).toBe(true);
    expect(stringWidth(painted)).toBeLessThanOrEqual(40);
  });

  test("note preview truncates by display width with a visible ellipsis", () => {
    const ctx = ctxFor(24, 40);
    const scene = new JournalScene([
      makeEntry("2026-03-01", 1, {
        notes: [{ text: "這是一條很長的反思註記".repeat(3), date: "2026-03-05" }],
      }),
    ]);
    scene.enter(ctx);

    const buf = CellBuffer.create(ctx.cols, ctx.rows);
    scene.render(buf, ctx);
    const painted = buf.getRow(ctx.rows - 2).map((c) => c.char).join("").trimEnd();
    expect(painted.endsWith("…")).toBe(true);
    expect(stringWidth(painted)).toBeLessThanOrEqual(40);
  });
});

describe("computeJournalPatterns", () => {
  test("derives totals, cadence, diversity, frequency, and line distributions", () => {
    const entries = [
      makeEntry("2026-03-01", 39, { cast: makeCast(39, 8, [5, 2]), method: "coin" }),
      makeEntry("2026-03-08", 39, { cast: makeCast(39, 15, [5]), method: "yarrow" }),
      makeEntry("2026-04-02", 1),
    ];
    const p = computeJournalPatterns(entries, "2026-04-15");
    expect(p.total).toBe(3);
    expect(p.thisMonth).toBe(1);
    expect(p.baseline.methods).toEqual({ coin: 1, yarrow: 1, unknown: 1, known: 2, total: 3 });
    expect(p.baseline.oldYin.observed).toBe(1);
    expect(p.baseline.oldYin.expected).toBeCloseTo(1.125, 4);
    expect(p.baseline.oldYang.observed).toBe(2);
    expect(p.baseline.oldYang.expected).toBeCloseTo(1.875, 4);
    expect(p.cadence).toMatchObject({
      firstDate: "2026-03-01",
      lastDate: "2026-04-02",
      spanDays: 33,
      activeDays: 3,
      recent30: 1,
      medianGapDays: 16,
      longestGapDays: 25,
      idleDays: 13,
    });
    expect(p.cadence?.castsPerActiveDay).toBe(1);
    expect(p.diversity.distinctHexagrams).toBe(2);
    expect(p.diversity.entropyBits).toBeCloseTo(0.918, 3);
    expect(p.diversity.normalizedEntropy).toBeCloseTo(0.579, 3);
    expect(p.diversity.topShare).toBeCloseTo(2 / 3, 3);
    expect(p.diversity.knownDistinctHexagrams).toBe(1);
    expect(p.diversity.observedRepeats).toBe(1);
    expect(p.diversity.expectedRepeats).toBeCloseTo(0.0156, 4);
    expect(p.topHexagrams[0]).toMatchObject({ kw: 39, count: 2, lastDate: "2026-03-08" });
    expect(p.topHexagrams[0].knownCount).toBe(2);
    expect(p.topHexagrams[0].share).toBeCloseTo(2 / 3, 3);
    expect(p.topHexagrams[0].lift).toBeCloseTo(64, 3);
    expect(p.topHexagrams[1]).toMatchObject({ kw: 1, count: 1, lastDate: "2026-04-02" });
    expect(p.topHexagrams[1].knownCount).toBe(0);
    expect(p.movingLines.map((line) => line.count)).toEqual([0, 1, 0, 0, 2, 0]);
    expect(p.movingLines.map((line) => line.knownCount)).toEqual([0, 1, 0, 0, 2, 0]);
    expect(p.movingLineCounts.map((bin) => bin.count)).toEqual([1, 1, 1, 0, 0, 0, 0]);
    expect(p.movingLineCounts.map((bin) => bin.knownCount)).toEqual([0, 1, 1, 0, 0, 0, 0]);
    expect(p.movingLine).toEqual({ position: 5, count: 2 });
    expect(p.topTransformations.map((pair) => [pair.from, pair.to, pair.count])).toEqual([
      [39, 8, 1],
      [39, 15, 1],
    ]);
    expect(p.topTransitions.map((pair) => [pair.from, pair.to, pair.count])).toEqual([
      [39, 1, 1],
      [39, 39, 1],
    ]);
    expect(p.topTrigrams.length).toBeGreaterThan(0);
    expect(p.topTrigrams[0].expected).toBeCloseTo(6 / 8, 4);
    expect(p.topStructuralEchoes.length).toBeGreaterThan(0);
    expect(p.hammingDrift?.transitions).toBe(2);
    // The dense field behind the 8×8 grid: every KW slot, all methods counted.
    expect(p.field.counts).toHaveLength(64);
    expect(p.field.counts[38]).toBe(2); // KW 39
    expect(p.field.counts[0]).toBe(1); // KW 1
    expect(p.field.counts.reduce((sum, c) => sum + c, 0)).toBe(3);
    expect(p.field.maxCount).toBe(2);
    expect(p.field.recent).toBe(1); // latest by time key: 2026-04-02, primary kw1
    // 兩儀 — every line's polarity, all 3 casts × 6 lines = 18 lines. makeCast
    // draws yang on odd positions (3) and yin on even (3) → 9 each per cast.
    expect(p.lineBalance.yang + p.lineBalance.yin).toBe(18);
    expect(p.lineBalance.yang).toBe(9);
    expect(p.lineBalance.yin).toBe(9);
  });

  test("empty journal and no moving lines stay calm", () => {
    const empty = computeJournalPatterns([], "2026-04-15");
    expect(empty.total).toBe(0);
    expect(empty.thisMonth).toBe(0);
    expect(empty.cadence).toBeNull();
    expect(empty.diversity).toEqual({
      distinctHexagrams: 0,
      knownDistinctHexagrams: 0,
      entropyBits: 0,
      maxEntropyBits: 0,
      normalizedEntropy: 0,
      topShare: 0,
      concentration: 0,
      expectedDistinctHexagrams: null,
      observedRepeats: 0,
      expectedRepeats: null,
      repeatLift: null,
    });
    expect(empty.topHexagrams).toEqual([]);
    expect(empty.movingLine).toBeNull();
    expect(empty.field.counts).toHaveLength(64);
    expect(empty.field.maxCount).toBe(0);
    expect(empty.field.recent).toBeNull();
    const p = computeJournalPatterns([makeEntry("2026-04-01", 2)], "2026-04-15");
    expect(p.movingLine).toBeNull();
    expect(p.movingLineCounts[0]).toMatchObject({ movingLines: 0, count: 1, share: 1 });
  });

  test("old-line observations count all entries; expectation stays method-marked", () => {
    // Two casts with a moving line each: one coin-marked, one unmarked.
    // Observed 6s/9s count both; expected rests only on the marked cast.
    const entries = [
      makeEntry("2026-03-01", 39, { cast: makeCast(39, 8, [2]), method: "coin" }), // 6 at pos2
      makeEntry("2026-03-02", 39, { cast: makeCast(39, 8, [2]) }), // unmarked, 6 at pos2
    ];
    const p = computeJournalPatterns(entries, "2026-04-15");
    expect(p.baseline.oldYin.observed).toBe(2); // both entries, not just the marked one
    expect(p.baseline.oldYang.observed).toBe(0);
    // Expectation is one coin cast worth of old-yin chance (6 lines × 1/8).
    expect(p.baseline.oldYin.expected).toBeCloseTo(0.75, 4);
    expect(p.baseline.methods.known).toBe(1);
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
