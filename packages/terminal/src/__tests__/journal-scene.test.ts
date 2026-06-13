// JournalScene — reflection notes, incremental search, nav parity,
// dictionary jump, and the patterns pane.

import { describe, test, expect } from "bun:test";
import type { Cast, Line } from "@iching/core";
import { computeJournalPatterns, GUA } from "@iching/core";
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
import { countUnit } from "../i18n/messages.ts";

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

describe("JournalScene resize", () => {
  test("shrinking the terminal keeps the selected reading on screen", () => {
    // Regression: resize() updated the list viewport height but never re-ran the
    // cursor-into-view math (only the patterns scroll re-clamped), so shrinking
    // with the selection near the bottom dropped it below the new fold until the
    // user arrowed it back into view.
    const entries = Array.from({ length: 18 }, (_, i) =>
      makeEntry(`2026-05-${String(i + 1).padStart(2, "0")}`, (i % 8) + 1),
    );
    const scene = new JournalScene(entries, { today: () => "2026-06-01" });
    const tall = ctxFor(24, 60);
    scene.enter(tall);
    for (let i = 0; i < entries.length; i++) {
      scene.handleKey({ type: "arrow", direction: "down" }, tall); // walk to the last reading
    }
    scene.resize(60, 12); // shrink
    const short = ctxFor(12, 60);
    const buf = CellBuffer.create(short.cols, short.rows);
    scene.render(buf, short);
    const selRow = Array.from({ length: short.rows }, (_, r) =>
      buf.getRow(r).map((c) => c.char).join(""),
    ).findIndex((l) => l.trimStart().startsWith(">"));
    expect(selRow).toBeGreaterThanOrEqual(0); // the selection is still on screen…
    expect(selRow).toBeLessThan(short.rows - 2); // …above the preview/footer rows
  });

  test("the image preview reserves room for the scroll indicator (no stray fragment)", () => {
    // Regression: the scroll indicator (right) and the image preview (left) both
    // render on rows-2. A full-width image overran the indicator, overwriting
    // all but its last column — leaving a stray ')' glued to the ellipsis. The
    // preview now reserves the indicator's width so the two coexist.
    const entries = [
      ...Array.from({ length: 12 }, (_, i) =>
        makeEntry(`2026-05-${String(i + 1).padStart(2, "0")}`, (i % 8) + 1),
      ),
      makeEntry("2026-05-20", 15), // most recent → selected; 謙 has the longest image
    ];
    const ctx = ctxFor(10, 60); // short height → list overflows → the indicator shows
    const scene = new JournalScene(entries, { today: () => "2026-06-01" });
    scene.enter(ctx);
    const buf = CellBuffer.create(ctx.cols, ctx.rows);
    scene.render(buf, ctx);
    const previewRow = buf.getRow(ctx.rows - 2).map((c) => c.char).join("");
    expect(previewRow).toMatch(/\d+\/\d+ \(\d+%\)/); // the indicator renders in full…
    expect(previewRow).toContain("mountain"); // …the image previews (謙: "A mountain…")…
    expect(previewRow).not.toMatch(/…\S/); // …and nothing is glued after its ellipsis.
  });
});

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

  test("matches reflection note text — find a reading by what you wrote about it", () => {
    const noted = makeEntry("2026-03-05", 2, {
      intention: "the quiet question",
      notes: [{ text: "this turned out to be about the job offer", date: "2026-03-06" }],
    });
    expect(entryMatchesQuery(noted, "job offer")).toBe(true); // the note
    expect(entryMatchesQuery(noted, "JOB")).toBe(true); // case-insensitive
    expect(entryMatchesQuery(noted, "the quiet question")).toBe(true); // intention still matches
    expect(entryMatchesQuery(noted, "nowhere")).toBe(false);
    expect(entryMatchesQuery(makeEntry("2026-03-07", 3), "job")).toBe(false); // no notes → unaffected
  });

  test("live search finds a reading by its reflection note", () => {
    const ctx = ctxFor();
    const scene = new JournalScene([
      makeEntry("2026-03-01", 1, { intention: "the launch question" }),
      makeEntry("2026-03-02", 39, { notes: [{ text: "the move to Portland", date: "2026-03-02" }] }),
    ]);
    scene.enter(ctx);
    press(scene, ctx, "/");
    type(scene, ctx, "portland");
    const text = renderText(scene, ctx);
    expect(text).toContain("1 reading"); // only the annotated reading matches
    expect(text).toContain("2026-03-02");
    expect(text).not.toContain("2026-03-01");
  });

  test("/ activates live filtering; enter opens the filtered selection", () => {
    const ctx = ctxFor();
    const scene = new JournalScene(entries);
    scene.enter(ctx);

    press(scene, ctx, "/");
    type(scene, ctx, "launch");

    const text = renderText(scene, ctx);
    expect(text).toContain("1 reading"); // one match — singular, not "1 readings"
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
    expect(renderText(scene, ctx)).toContain("1 reading"); // one match — singular

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

  test("a search matching nothing shows a quiet hint, not a blank list", () => {
    const ctx = ctxFor();
    const scene = new JournalScene(entries);
    scene.enter(ctx);

    press(scene, ctx, "/");
    type(scene, ctx, "zzznomatch");
    const text = renderText(scene, ctx);
    expect(text).toContain("0 readings");
    expect(text).toContain("no reading answers that"); // the empty-search hint
    expect(text).toContain("clear search"); // the footer still offers the way out
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
    expect(text).toContain("1 reading"); // one match \u2014 singular
    expect(text).toContain("the launch question");
  });

  test("the cursor clamps into bounds when a search shrinks the result set", () => {
    // With the cursor near the bottom of the full list, a query that filters to
    // fewer readings must clamp the cursor into the new range \u2014 otherwise it
    // indexes past `filtered` (a crash on filtered[cursor], or no selection
    // shown). setQuery clamps; this guards that clamp.
    const many = Array.from({ length: 18 }, (_, i) =>
      makeEntry(`2026-05-${String(i + 1).padStart(2, "0")}`, (i % 8) + 1, {
        intention: i < 3 ? "rare topic" : "common topic",
      }),
    );
    const ctx = ctxFor();
    const scene = new JournalScene(many);
    scene.enter(ctx);
    for (let i = 0; i < many.length; i++) {
      scene.handleKey({ type: "arrow", direction: "down" }, ctx); // cursor to the last reading (17)
    }
    scene.handleKey({ type: "char", char: "/" }, ctx);
    for (const ch of "rare") scene.handleKey({ type: "char", char: ch }, ctx); // filter 18 \u2192 3
    const s = scene as unknown as { cursor: number; filtered: unknown[] };
    expect(s.filtered.length).toBe(3);
    expect(s.cursor).toBeGreaterThanOrEqual(0);
    expect(s.cursor).toBeLessThan(s.filtered.length); // clamped into the new range\u2026
    expect(renderText(scene, ctx)).toContain(">"); // \u2026and a selection still renders.
  });
});

describe("JournalScene mode exclusivity", () => {
  test("cross-mode keys are captured as input, never open a second mode", () => {
    // Key routing checks noteActive → patternsOpen → searchActive and returns,
    // so a key that would open another mode (e.g. [p] while searching) lands in
    // the active handler as input instead. Guards against two of
    // note/patterns/search being live at once, or a flag leaking on esc.
    const entries = [makeEntry("2026-03-01", 1, { intention: "topic" }), makeEntry("2026-03-02", 2)];
    const scene = new JournalScene(entries);
    const ctx = ctxFor();
    scene.enter(ctx);
    const activeModes = (): number => {
      const s = scene as unknown as { noteActive: boolean; patternsOpen: boolean; searchActive: boolean };
      return [s.noteActive, s.patternsOpen, s.searchActive].filter(Boolean).length;
    };
    const send = (...keys: Array<{ type: string; char?: string }>): void => {
      for (const k of keys) scene.handleKey(k as never, ctx);
    };
    const C = (c: string) => ({ type: "char", char: c });
    const ESC = { type: "escape" };
    // In search, [p]/[n] are query text — not patterns/note:
    send(C("/"), C("p"), C("n"));
    expect(activeModes()).toBe(1); // only search, not three
    send(ESC);
    expect(activeModes()).toBe(0); // esc returns to the clean list
    // In patterns, [n]/[/] don't open note/search:
    send(C("p"), C("n"), C("/"));
    expect(activeModes()).toBe(1);
    send(ESC);
    expect(activeModes()).toBe(0);
    // In note, [/]/[p] don't open search/patterns:
    send(C("n"), C("/"), C("p"));
    expect(activeModes()).toBe(1);
    send(ESC);
    expect(activeModes()).toBe(0);
  });
});

describe("JournalScene empty state", () => {
  test("a journal with no readings still shows how to leave, with no dead keys", () => {
    // The most novice state \u2014 zero readings \u2014 must still tell the user how to
    // get out. The populated footer advertises view/note/search/patterns, but
    // those do nothing with no entries; the empty state shows ONLY [esc] back.
    // Regression: the empty branch returned before renderFooter, so it had no
    // footer at all \u2014 a new user saw "No readings yet" and no way out.
    const ctx = ctxFor();
    const scene = new JournalScene([], { today: () => "2026-05-10" });
    scene.enter(ctx);
    const text = renderText(scene, ctx);
    expect(text).toContain("No readings yet"); // the calm empty message\u2026
    expect(text).toContain("[esc] back"); // \u2026and the one real action (the footer is back)
    expect(text).not.toContain("[n] note"); // no dead keys dangled\u2026
    expect(text).not.toContain("[p] patterns");
    expect(text).not.toContain("[/] search");
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

  test("the ·note marker survives a long intention (structural signal over content)", () => {
    // A row crowded with time + becoming + changing positions + a long intention
    // overflows 80 cols. The note marker is a STRUCTURAL signal ("this reading
    // carries a reflection") and must not be the casualty — the intention
    // (content) clips with an ellipsis while the marker holds its reserved width.
    const ctx = ctxFor(); // 80 cols
    const entries = [
      makeEntry("2026-03-05", 2), // most recent, selected, no note
      makeEntry("2026-03-01", 11, {
        timestamp: "2026-03-01T08:00:00.000Z",
        cast: makeCast(11, 12, [2, 4]), // 泰 → 否 [2,4]
        intention: "about the move to a new city and what it all means for us",
        notes: [{ text: "a quiet reflection", date: "2026-03-01" }],
      }),
    ];
    const scene = new JournalScene(entries);
    scene.enter(ctx);
    const rowText =
      renderText(scene, ctx)
        .split("\n")
        .find((l) => l.includes("2026-03-01")) ?? "";
    expect(rowText).toContain("·note"); // the marker held its ground…
    expect(rowText).toContain("…"); // …because the intention clipped to make room
    expect(rowText).not.toContain("means for us"); // the intention tail was what gave way
  });

  test("the ·註 marker survives a long CJK intention (zh-Hant, width-2 marker)", () => {
    // Same guarantee in zh-Hant, where the marker is ·註 and the intention is
    // CJK (each glyph width-2). Guards that the marker-reservation + truncation
    // path holds in the i18n dimension — the marker stays and the CJK intention
    // clips on a glyph boundary (never mid-character). (It does not isolate
    // stringWidth-vs-.length: under-reserving by one column there overflows the
    // budget by one rather than dropping the marker — the column-alignment test
    // below is what pins display-width measurement.)
    const ctx = { ...ctxFor(), language: "zh-Hant" as const };
    const entries = [
      makeEntry("2026-03-05", 2), // most recent, selected, no note
      makeEntry("2026-03-01", 11, {
        timestamp: "2026-03-01T08:00:00.000Z",
        cast: makeCast(11, 12, [2, 4]),
        intention: "關於搬到新城市這件事對全家人的意義", // long CJK intention
        notes: [{ text: "一個安靜的省思", date: "2026-03-01" }],
      }),
    ];
    const scene = new JournalScene(entries);
    scene.enter(ctx);
    const rowText =
      renderText(scene, ctx)
        .split("\n")
        .find((l) => l.includes("2026-03-01")) ?? "";
    expect(rowText).toContain("·註"); // the width-2 marker survived…
    expect(rowText).toContain("…"); // …the CJK intention clipped to make room
    expect(rowText).not.toContain("意義"); // the intention tail gave way, on a glyph boundary
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

  test("the open pane suppresses the journal-list header and opens near the top", () => {
    // Regression: the journal title/count/separator chrome used to sit above the
    // pane, competing with its own 觀象 rule and restating the count. The
    // observatory now owns the screen — its rule is the header, near the top.
    const ctx = ctxFor(24, 80);
    const scene = new JournalScene(entries, { today: () => "2026-04-15" });
    scene.enter(ctx);
    press(scene, ctx, "p");
    const buf = CellBuffer.create(ctx.cols, ctx.rows);
    scene.render(buf, ctx);
    const lines = Array.from({ length: ctx.rows }, (_, r) =>
      buf.getRow(r).map((c) => c.char).join(""),
    );
    // No journal-list title, and no centred 60-dash separator row above the pane.
    expect(lines.join("\n")).not.toContain("Journal");
    expect(lines[0].trim()).toBe(""); // a calm top margin, not the old header row
    // The 觀象 rule is the pane's header, near the top (row 1), not pushed to row 3.
    const ruleRow = lines.findIndex((l) => l.includes("觀象 · patterns"));
    expect(ruleRow).toBe(1);

    // …and the journal-list header returns on the way back out (the toggle
    // suppresses the chrome, it doesn't destroy it).
    press(scene, ctx, "escape");
    const back = renderText(scene, ctx);
    expect(back).not.toContain("觀象 · patterns"); // pane closed
    expect(back).toContain("Journal"); // list title restored
    expect(back).toContain(`${entries.length} readings`); // count restored
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

    // 36 content rows over a 7-row viewport (the pane owns the screen, no
    // journal header above it): 6 pages.
    press(scene, ctx, "p");
    let text = renderText(scene, ctx);
    expect(text).toContain("觀象 · patterns");
    // The journal-list title chrome is gone in the pane (the count is restated
    // inside the pane itself; only the journal *title* would be redundant).
    expect(text).not.toContain("Journal");
    expect(text).toContain("1/6");
    expect(text).not.toContain("卦象 · faces seen");

    scene.handleKey({ type: "page", direction: "down" }, ctx);
    text = renderText(scene, ctx);
    expect(text).toContain("2/6");

    scene.handleKey({ type: "end" }, ctx);
    text = renderText(scene, ctx);
    expect(text).toContain("兩儀 · two modes"); // the bottom coda
    expect(text).toContain("yin 12 · yang 12");
    // End reaches the true last page (the fixed free-scroll indicator).
    expect(text).toContain("6/6");

    scene.handleKey({ type: "home" }, ctx);
    expect(renderText(scene, ctx)).toContain("觀象 · patterns");

    press(scene, ctx, "p"); // close and reset
    press(scene, ctx, "p"); // reopen
    text = renderText(scene, ctx);
    expect(text).toContain("觀象 · patterns");
    expect(text).toContain("1/6");
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

  test("malformed entries are tolerated, not fatal, in list and patterns", () => {
    // A record missing its cast.lines (pre-format) or its cast entirely
    // (corrupt) must not take the whole scene down — storage validates, but
    // the scene is defensive. The good readings still render and count.
    const noLines = {
      date: "2026-03-02",
      cast: {
        primary: 5,
        becoming: null,
        changingPositions: [],
        nuclear: 1,
        polarity: 1,
        mirror: 1,
        diagonal: 1,
      },
    } as unknown as JournalEntryView;
    const noCast = { date: "2026-03-03" } as unknown as JournalEntryView;
    const entries = [
      makeEntry("2026-03-01", 39, { method: "coin" }),
      noLines,
      noCast,
      makeEntry("2026-03-04", 8, { method: "coin" }),
    ];
    const ctx = ctxFor(45, 80);
    const scene = new JournalScene(entries, { today: () => "2026-04-15" });
    scene.enter(ctx);
    // The cast-less entry is dropped at the boundary; lines-less survives.
    const list = renderText(scene, ctx);
    expect(list).toContain("3 readings"); // 4 in, 1 cast-less dropped
    expect(() => {
      press(scene, ctx, "p");
      renderText(scene, ctx);
    }).not.toThrow();
    const patterns = renderText(scene, ctx);
    expect(patterns).toContain("3 readings"); // derivation agrees
    expect(patterns).toContain("觀象 · patterns");
  });

  test("the pane degrades gracefully on a no-color terminal", () => {
    // colorSupport 'none' strips fg tones but keeps bold/dim, so the field
    // must still read: never-seen glyphs dim, the rest carrying their bold.
    // All textual content and the ▅/▁ bars (glyph-encoded) survive intact.
    const entries = [1, 1, 1, 1, 1, 2, 2, 3, 4, 5].map((kw, i) =>
      makeEntry(`2026-03-${String(i + 1).padStart(2, "0")}`, kw, { method: "coin" }),
    );
    const ctx: SceneContext = { cols: 80, rows: 50, colorSupport: "none", language: "en", done: false };
    const scene = new JournalScene(entries, { today: () => "2026-04-15" });
    scene.enter(ctx);
    press(scene, ctx, "p");
    const buf = CellBuffer.create(80, 50);
    expect(() => scene.render(buf, ctx)).not.toThrow();
    const text = Array.from({ length: 50 }, (_, r) =>
      buf.getRow(r).map((c) => c.char).join(""),
    ).join("\n");
    // Textual content and bars survive (they don't depend on color).
    expect(text).toContain("觀象 · patterns");
    expect(text).toContain("卦象 · faces seen");
    expect(text).toContain("▅");
    expect(text).toContain("兩儀");
    // The field keeps a readable structure via attributes: never-seen dim,
    // a high-frequency / recent glyph bold.
    let anyDim = false;
    let anyBold = false;
    for (let r = 0; r < buf.height; r++) {
      for (const cell of buf.getRow(r)) {
        const code = cell.char.codePointAt(0) ?? 0;
        if (code >= 0x4dc0 && code <= 0x4dff) {
          if (cell.dim) anyDim = true;
          if (cell.bold) anyBold = true;
        }
      }
    }
    expect(anyDim).toBe(true); // the dark, never-cast field
    expect(anyBold).toBe(true); // frequent + most-recent
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

  test("the patterns cache recomputes when a new cast lands on the same day", () => {
    // The memo key carries the reading count, not just `today` — so a cast
    // arriving while the pane lives (same calendar day) invalidates the cache
    // instead of serving a stale derivation until midnight. Guards the
    // GPT-Pro review's same-day-staleness vector even if a future caller
    // mutates the entries array in place rather than constructing afresh.
    const scene = new JournalScene(
      [makeEntry("2026-04-10", 1, { method: "coin" }), makeEntry("2026-04-11", 2, { method: "coin" })],
      { today: () => "2026-04-15" },
    );
    const ctx = ctxFor(45, 80);
    scene.enter(ctx);
    press(scene, ctx, "p");
    expect(renderText(scene, ctx)).toContain("2 readings"); // derivation over the two casts
    // A new cast lands in-place on the same day (count 2 → 3).
    (scene as unknown as { entries: JournalEntryView[] }).entries.push(
      makeEntry("2026-04-15", 3, { method: "coin" }),
    );
    expect(renderText(scene, ctx)).toContain("3 readings"); // cache invalidated, not stale at "2 readings"
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

  test("the field encodes frequency as distinct colour tiers, recency as the accent", () => {
    // The field's whole function is its brightness gradient — how often a
    // hexagram has come up (○ unseen · ◦ once · ◐ a few · ● often) — with the
    // single accent reserved for the most recent reading (recency over
    // frequency). This is a COLOUR property invisible to the mono tests: only
    // the accent was locked before, so a drift in the count→tier thresholds
    // would silently flatten the field and no test would notice. Pin all five.
    const { getTheme } = require("../color/theme.ts");
    const t = getTheme();
    const entries = [
      // hex 1 ×4 (often) on early dates, so it is NOT the most recent…
      ...Array.from({ length: 4 }, (_, i) => makeEntry(`2026-03-0${i + 1}`, 1, { method: "coin" })),
      makeEntry("2026-03-05", 2, { method: "coin" }), // hex 2 ×2 (a few)…
      makeEntry("2026-03-06", 2, { method: "coin" }),
      makeEntry("2026-03-07", 3, { method: "coin" }), // hex 3 ×1 (once)
      makeEntry("2026-03-20", 10, { method: "coin" }), // hex 10 ×1 but MOST RECENT → accent
    ];
    const ctx = ctxFor(45, 80);
    const scene = new JournalScene(entries, { today: () => "2026-03-21" });
    scene.enter(ctx);
    press(scene, ctx, "p");
    const buf = CellBuffer.create(ctx.cols, ctx.rows);
    scene.render(buf, ctx);
    const cellFor = (kw: number) => {
      const glyph = GUA[kw - 1].u;
      for (let r = 0; r < buf.height; r++)
        for (const cell of buf.getRow(r)) if (cell.char === glyph) return cell;
      return undefined;
    };
    expect(cellFor(1)?.fg).toBe(t.primary); // ×4 → ● often
    expect(cellFor(1)?.bold).toBe(true); // …and bold, like the legend's ●
    expect(cellFor(2)?.fg).toBe(t.secondary); // ×2 → ◐ a few
    expect(cellFor(3)?.fg).toBe(t.tertiary); // ×1 → ◦ once
    expect(cellFor(5)?.fg).toBe(t.dimmed); // ×0 → ○ not yet
    expect(cellFor(10)?.fg).toBe(t.accent); // ×1 but most recent → ◉ now overrides the tier
  });

  test("the 卦象/爻象/八卦 bars align by display column in zh-Hant, same as English", () => {
    // The three sparkline sections share one start column so the pane reads as a
    // single aligned field. CJK labels (乾, 上爻, ☷ 坤) carry different display
    // widths than their English forms (乾 Qián, line 6 · 上), so the label
    // padding must measure display width, not character count — a property the
    // English-only tests can't exercise. Assert every label-aligned bar shares
    // one column in zh-Hant, and that it's the SAME column English lands on.
    const entries = [
      makeEntry("2026-03-01", 1, { method: "coin", cast: makeCast(1, 2, [3]) }),
      makeEntry("2026-03-02", 2, { method: "yarrow", cast: makeCast(2, 11, [1, 4]) }),
      makeEntry("2026-03-03", 11, { method: "coin", cast: makeCast(11, 12, [2]) }),
      makeEntry("2026-03-04", 1, { method: "coin" }),
      makeEntry("2026-03-05", 29, { method: "yarrow", cast: makeCast(29, 30, [5]) }),
    ];
    const barColumns = (language: "en" | "zh-Hant"): Set<number> => {
      const ctx = { ...ctxFor(45, 80), language };
      const scene = new JournalScene(entries, { today: () => "2026-03-10" });
      scene.enter(ctx);
      press(scene, ctx, "p");
      const buf = CellBuffer.create(ctx.cols, ctx.rows);
      scene.render(buf, ctx);
      const cols = new Set<number>();
      for (let r = 0; r < buf.height; r++) {
        const row = buf.getRow(r);
        // The 兩儀 two-modes bar is a centered split (⚋ ▅▅│▅▅ ⚊), not a
        // label-aligned section bar — exclude it from the alignment check.
        if (row.some((cell) => cell.char === "⚋" || cell.char === "⚊")) continue;
        const c = row.findIndex((cell) => cell.char === "▅" || cell.char === "▁");
        if (c >= 0) cols.add(c);
      }
      return cols;
    };
    const en = barColumns("en");
    const hant = barColumns("zh-Hant");
    expect(en.size).toBe(1); // English: every section bar starts at one column…
    expect(hant.size).toBe(1); // …zh-Hant too — CJK widths don't break the field…
    expect([...hant][0]).toBe([...en][0]); // …and it is the SAME column as English.
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

  test("the 大象傳 image preview truncates to fit rather than vanishing", () => {
    // Regression: the image teaser used a fits-or-nothing guard, so at common
    // widths most readings showed a BLANK preview row (33/64 vanish at 80 cols,
    // every one below ~60). It now truncates like every other row — the
    // evocative opening (the natural image itself) stays, with an ellipsis.
    const ctx = ctxFor(24, 60); // every hexagram image overflows 60 cols
    // hexagram 15 謙 carries the longest image; it must preview, not vanish.
    const scene = new JournalScene([makeEntry("2026-03-01", 15)]);
    scene.enter(ctx);
    const buf = CellBuffer.create(ctx.cols, ctx.rows);
    scene.render(buf, ctx);
    const painted = buf.getRow(ctx.rows - 2).map((c) => c.char).join("").trimEnd();
    expect(painted.trim().length).toBeGreaterThan(0); // not the old blank row…
    expect(painted).toContain("mountain"); // …the natural-image opening survives…
    expect(painted.endsWith("…")).toBe(true); // …with a visible ellipsis…
    expect(stringWidth(painted)).toBeLessThanOrEqual(60); // …and no overflow.
  });
});

// The pure-derivation tests for computeJournalPatterns moved to the core
// package alongside the module (packages/core/src/__tests__/journal-patterns.test.ts).
// This suite keeps the rendering tests — the 觀象 pane — above.

describe("count unit pluralizes English, leaves zh measure words invariant", () => {
  test("countUnit: 1 is singular in en, plural otherwise; zh is count-invariant", () => {
    expect(countUnit("en", 1, "journal.countSuffix")).toBe("reading");
    expect(countUnit("en", 0, "journal.countSuffix")).toBe("readings");
    expect(countUnit("en", 2, "journal.countSuffix")).toBe("readings");
    expect(countUnit("en", 1, "dict.countSuffix")).toBe("hexagram");
    expect(countUnit("en", 5, "dict.countSuffix")).toBe("hexagrams");
    // 則 / 卦 are measure words — the same at every count.
    expect(countUnit("zh-Hant", 1, "journal.countSuffix")).toBe("則");
    expect(countUnit("zh-Hant", 9, "journal.countSuffix")).toBe("則");
    expect(countUnit("zh-Hans", 1, "journal.countSuffix")).toBe("则");
    expect(countUnit("zh-Hant", 1, "dict.countSuffix")).toBe("卦");
  });

  test("the journal list header reads '1 reading', not '1 readings'", () => {
    // ctxFor() renders in en; the list header count lives on row 0.
    const one = new JournalScene([makeEntry("2026-03-01", 1)]);
    expect(renderText(one, ctxFor())).toContain("1 reading");
    expect(renderText(one, ctxFor())).not.toContain("1 readings");

    const two = new JournalScene([makeEntry("2026-03-01", 1), makeEntry("2026-03-02", 2)]);
    expect(renderText(two, ctxFor())).toContain("2 readings");
  });
});

describe("JournalScene list ordering agrees with the pane's recency accent", () => {
  test("newest by date sits on top, even when an older reading was recorded last", () => {
    // File order = oldest-recorded first → newest-recorded last. Here the LAST
    // entry is an old import (03-25) recorded after a newer reading (03-30); a
    // plain reverse() would float that old import to the top as "newest".
    const entries = [
      makeEntry("2026-03-30", 11), // 泰 — the actual newest by date
      makeEntry("2026-03-25", 22), // 賁 — older date, recorded last (an import)
    ];
    const scene = new JournalScene(entries);
    const ctx = ctxFor();
    scene.enter(ctx);
    const rows = renderText(scene, ctx).split("\n");
    const rowOfTai = rows.findIndex((l) => l.includes("泰"));
    const rowOfBi = rows.findIndex((l) => l.includes("賁"));
    expect(rowOfTai).toBeGreaterThanOrEqual(0);
    expect(rowOfBi).toBeGreaterThanOrEqual(0);
    expect(rowOfTai).toBeLessThan(rowOfBi); // newest date on top, not the late import

    // …and the pane's ◉ recency accent marks the SAME reading, by construction:
    // both order by entryTimeKey, so list-top and field.recent can't disagree.
    expect(computeJournalPatterns(entries, "2026-04-15").field.recent).toBe(11);
  });
});

describe("觀象 pane — 時 phase-of-day section", () => {
  const timed = (date: string, primary: number, ts: string): JournalEntryView =>
    makeEntry(date, primary, { timestamp: ts });

  // Five readings with a recorded hour clears PHASE_MIN_TIMESTAMPED.
  const fiveTimed = (): JournalEntryView[] => [
    timed("2026-03-01", 1, "2026-03-01T07:00:00.000Z"),
    timed("2026-03-02", 2, "2026-03-02T13:00:00.000Z"),
    timed("2026-03-03", 3, "2026-03-03T19:00:00.000Z"),
    timed("2026-03-04", 4, "2026-03-04T20:00:00.000Z"),
    timed("2026-03-05", 5, "2026-03-05T21:00:00.000Z"),
  ];

  test("renders the phase section, its four labels, and the honest timed count", () => {
    const scene = new JournalScene(fiveTimed());
    const ctx = ctxFor(44, 100); // tall + wide: the whole pane fits, no scroll
    scene.enter(ctx);
    press(scene, ctx, "p");
    const text = renderText(scene, ctx);
    expect(text).toContain("phase of day"); // circumstance, not "hours of asking"
    expect(text).toContain("5 timed"); // all five timestamped → bare count, no fraction
    for (const label of ["dawn", "midday", "dusk", "night"]) expect(text).toContain(label);
  });

  test("discloses the timed fraction when some readings lack a recorded hour", () => {
    const scene = new JournalScene([...fiveTimed(), makeEntry("2026-03-06", 6)]); // +1 legacy
    const ctx = ctxFor(44, 100);
    scene.enter(ctx);
    press(scene, ctx, "p");
    const text = renderText(scene, ctx);
    expect(text).toContain("phase of day");
    expect(text).toContain("5/6 timed"); // 5 of 6 have a usable hour — 1 omitted, disclosed
  });

  test("absent when too few readings carry a timestamp (legacy entries don't count)", () => {
    const entries = [
      timed("2026-03-01", 1, "2026-03-01T07:00:00.000Z"),
      timed("2026-03-02", 2, "2026-03-02T13:00:00.000Z"),
      makeEntry("2026-03-03", 3), // legacy, no recorded hour
      makeEntry("2026-03-04", 4),
    ];
    const scene = new JournalScene(entries);
    const ctx = ctxFor(44, 100);
    scene.enter(ctx);
    press(scene, ctx, "p");
    expect(renderText(scene, ctx)).not.toContain("phase of day");
  });

  test("an empty phase shows a quiet dot; the clustered one a block", () => {
    // Five readings at the SAME instant-of-day land in ONE phase whatever the
    // runner's timezone — so exactly one phase fills (█) and the rest are dots.
    const sameInstant = [1, 2, 3, 4, 5].map((i) =>
      timed(`2026-03-0${i}`, i, `2026-03-0${i}T18:30:00.000Z`),
    );
    const scene = new JournalScene(sameInstant);
    const ctx = ctxFor(44, 100);
    scene.enter(ctx);
    press(scene, ctx, "p");
    const phaseLine = renderText(scene, ctx)
      .split("\n")
      .find((l) => /dawn|midday|dusk|night/.test(l))!;
    expect(phaseLine).toBeDefined();
    expect(phaseLine).toContain("█"); // the one clustered phase fills
    expect(phaseLine).toContain("·"); // the empty phases read as quiet dots
  });

  test("zh-Hans renders the simplified phase glyphs (时 / 昼 / 记时)", () => {
    const scene = new JournalScene(fiveTimed());
    const ctx: SceneContext = {
      cols: 100,
      rows: 44,
      colorSupport: "truecolor",
      language: "zh-Hans",
      done: false,
    };
    scene.enter(ctx);
    scene.handleKey({ type: "char", char: "p" }, ctx);
    const buf = CellBuffer.create(100, 44);
    scene.render(buf, ctx);
    const text = Array.from({ length: buf.height }, (_, r) =>
      buf.getRow(r).map((c) => c.char).join(""),
    ).join("\n");
    expect(text).toContain("时"); // simplified section title (時 → 时)
    expect(text).toContain("昼"); // simplified 晝 day phase (晝 → 昼)
    expect(text).toContain("记时"); // simplified timed suffix (記時 → 记时)
  });
});
