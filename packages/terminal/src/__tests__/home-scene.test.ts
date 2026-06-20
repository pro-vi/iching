// HomeScene — [t] today menu item (reopen the daily reading) and quit/back
// consistency (escape is a no-op on Home; q and Ctrl+C remain the exits).

import { describe, expect, test } from "bun:test";
import { bufferText, sceneCtx } from "../testing.ts";
import { buildStructure, castHexagram, SeededRandomSource } from "@iching/core";
import type { DailyCache } from "@iching/core";
import { HomeScene } from "../scenes/home/home-scene.ts";
import { CellBuffer } from "../render/buffer.ts";

function makeTodayCast(): DailyCache {
  const cast = castHexagram(new SeededRandomSource(7));
  return {
    date: "2026-06-10",
    cast,
    shown: true,
    structure: buildStructure(cast),
    intention: "morning sit",
  };
}

function makeScene(todayCast: DailyCache | null): HomeScene {
  return new HomeScene({ todayCast, taijituStyle: "dots" });
}

describe("HomeScene today menu item", () => {
  test("shows [t] Today between cast and dictionary when a cast exists", () => {
    const scene = makeScene(makeTodayCast());
    const ctx = sceneCtx(80, 30);
    const buf = CellBuffer.create(ctx.cols, ctx.rows);
    scene.render(buf, ctx);
    const rows = bufferText(buf).split("\n");
    const castRow = rows.findIndex((l) => l.includes("[c]"));
    const todayRow = rows.findIndex((l) => l.includes("[t]"));
    const dictRow = rows.findIndex((l) => l.includes("[d]"));
    expect(todayRow).toBeGreaterThan(castRow);
    expect(todayRow).toBeLessThan(dictRow);
    expect(rows[todayRow]).toContain("Today");
  });

  test("hides [t] when there is no cast today (quiet empty line stays)", () => {
    const scene = makeScene(null);
    const ctx = sceneCtx(80, 30);
    const buf = CellBuffer.create(ctx.cols, ctx.rows);
    scene.render(buf, ctx);
    const text = bufferText(buf);
    expect(text).not.toContain("[t]");
    expect(text).toContain("No cast today");
  });

  test("t emits openToday when a cast exists", () => {
    const scene = makeScene(makeTodayCast());
    const signal = scene.handleKey({ type: "char", char: "t" }, sceneCtx(80, 30));
    expect(signal).toEqual({ type: "openToday" });
  });

  test("t is inert when there is no cast today", () => {
    const scene = makeScene(null);
    const signal = scene.handleKey({ type: "char", char: "t" }, sceneCtx(80, 30));
    expect(signal).toBeUndefined();
  });
});

describe("HomeScene quit/back consistency", () => {
  // Regression: escape used to hard-exit the app — one habitual extra esc
  // after backing out of the journal terminated the session.
  test("escape is a no-op on Home", () => {
    const scene = makeScene(makeTodayCast());
    const signal = scene.handleKey({ type: "escape" }, sceneCtx(80, 30));
    expect(signal).toBeUndefined();
  });

  test("q and Ctrl+C still exit", () => {
    const scene = makeScene(null);
    expect(scene.handleKey({ type: "char", char: "q" }, sceneCtx(80, 30))).toEqual({ type: "exit" });
    expect(scene.handleKey({ type: "ctrl", char: "c" }, sceneCtx(80, 30))).toEqual({ type: "exit" });
  });
});
