#!/usr/bin/env bun
// Headless cast recorder.
//
// Drives a ritual scene (yarrow or coins) through an off-screen 30fps frame
// loop, diff-renders each frame to ANSI, and writes a timed recording JSON
// that the web/ page replays into a wterm terminal emulator.
//
//   bun scripts/record-cast.ts --method yarrow --preset default --seed 42
//
// Output: web/recordings/<method>.json

import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  CastScene,
  YarrowScene,
  YarrowManualScene,
  CellBuffer,
  DiffRenderer,
  hideCursor,
  setTheme,
  type KeyEvent,
  type MotionPreset,
  type SceneContext,
  type ThemeName,
} from "../packages/terminal/src/index.ts";
import { castHexagram, SeededRandomSource } from "../packages/core/src/index.ts";

const COLS = 80;
const ROWS = 24;
const FPS = 30;
const DT = 1000 / FPS;
const MAX_FRAMES = FPS * 240; // 4 min safety cap
const HOLD_FRAMES = 40; // ~1.3s holding the finished figure

interface RecordingFrame {
  /** Milliseconds to wait before writing this patch. */
  delayMs: number;
  /** ANSI patch for this frame. */
  data: string;
}

interface Recording {
  cols: number;
  rows: number;
  method: string;
  preset: string;
  theme: string;
  seed: number;
  /** Written once before playback (cursor hidden). */
  init: string;
  frames: RecordingFrame[];
}

function arg(flag: string, fallback: string): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const method = arg("--method", "yarrow");
const preset = arg("--preset", "default") as MotionPreset;
const seed = Number(arg("--seed", "42"));
const theme = arg("--theme", "bone") as ThemeName;
const out = resolve(arg("--out", `web/recordings/${method}.json`));

setTheme(theme);

const source = new SeededRandomSource(seed);
const ctx = {} as SceneContext;

const sink = {
  buf: "",
  write(data: string): boolean {
    this.buf += data;
    return true;
  },
};
const renderer = new DiffRenderer(sink, "truecolor");

let prev = new CellBuffer(COLS, ROWS);
let elapsed = 0;
let pendingDelay = 0;
let held = 0;
const frames: RecordingFrame[] = [];

if (method === "yarrow-manual") {
  // H6 manual yarrow: synthetic operator simulates the sweep-and-snap gesture.
  // For each line: press Space to start sweeping; let the aperture travel
  // to TARGET_LEFTS[lineIdx]; press Space again to snap; scene's snap-hold
  // auto-transitions to playing; wait for the round + fuse to complete.
  const TARGET_LEFTS = [8, 20, 32, 5, 28, 14];      // varied aperture positions per line
  const space: KeyEvent = { type: "char", char: " " };

  const manual = new YarrowManualScene(preset, source);
  manual.enter(ctx);
  let prevLineIdx = -1;
  let waitingToSnap = false;
  let snappedThisLine = false;

  for (let i = 0; i < MAX_FRAMES; i++) {
    manual.update(elapsed, DT, ctx);
    const frame = new CellBuffer(COLS, ROWS);
    manual.render(frame, ctx);

    sink.buf = "";
    renderer.present(prev, frame);
    pendingDelay += DT;
    if (sink.buf.length > 0) {
      frames.push({ delayMs: Math.round(pendingDelay), data: sink.buf });
      pendingDelay = 0;
    }
    prev = frame;
    elapsed += DT;

    const lineIdx = manual.getLineIdx();
    if (lineIdx !== prevLineIdx && lineIdx < TARGET_LEFTS.length) {
      waitingToSnap = false;
      snappedThisLine = false;
      prevLineIdx = lineIdx;
    }

    const phase = manual.getPhase();
    if (phase === "gathering" && !waitingToSnap && lineIdx < TARGET_LEFTS.length) {
      // Begin the sweep.
      manual.handleKey(space, ctx);
      waitingToSnap = true;
    } else if (phase === "sweeping" && waitingToSnap && !snappedThisLine) {
      // Once the aperture reaches the target, snap.
      if (manual.getApertureLeft() >= TARGET_LEFTS[lineIdx]) {
        manual.handleKey(space, ctx);
        snappedThisLine = true;
      }
    }

    if (phase === "complete") {
      held++;
      if (held >= HOLD_FRAMES) break;
    }
  }
} else {
  const scene =
    method === "coins"
      ? new CastScene(castHexagram(source), preset, COLS, undefined, ROWS)
      : new YarrowScene(preset, source);
  const duration = scene.getTimeline().duration;

  for (let i = 0; i < MAX_FRAMES; i++) {
    scene.update(elapsed, DT, ctx);
    const frame = new CellBuffer(COLS, ROWS);
    scene.render(frame, ctx);

    sink.buf = "";
    renderer.present(prev, frame);
    pendingDelay += DT;
    if (sink.buf.length > 0) {
      frames.push({ delayMs: Math.round(pendingDelay), data: sink.buf });
      pendingDelay = 0;
    }
    prev = frame;
    elapsed += DT;

    if (elapsed >= duration) {
      held++;
      if (held >= HOLD_FRAMES) break;
    }
  }
}

const recording: Recording = {
  cols: COLS,
  rows: ROWS,
  method,
  preset,
  theme,
  seed,
  init: hideCursor,
  frames,
};

await mkdir(dirname(out), { recursive: true });
await Bun.write(out, JSON.stringify(recording));

const totalMs = frames.reduce((a, f) => a + f.delayMs, 0);
console.log(
  `recorded ${method} (${preset}, seed ${seed}, ${theme}): ` +
    `${frames.length} frames, ${(totalMs / 1000).toFixed(1)}s → ${out}`,
);
