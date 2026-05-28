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
  // 18-cut full manual yarrow: synthetic operator sweeps + snaps per round.
  // For each of 18 atoms: press Space to start sweeping; let the aperture
  // travel to a deterministic target (scaled to the current pile size);
  // press Space again to snap; the round + (fuse if round 3) play out.
  const SWEEP_TARGETS = [
    // Line 1            Line 2           Line 3           Line 4           Line 5           Line 6
    0.20, 0.55, 0.30,   0.15, 0.45, 0.70, 0.60, 0.25, 0.40, 0.35, 0.80, 0.15, 0.50, 0.30, 0.65, 0.25, 0.55, 0.40,
  ];
  const space: KeyEvent = { type: "char", char: " " };

  const manual = new YarrowManualScene(preset, source);
  manual.enter(ctx);
  let prevAtomIdx = -1;
  let waitingToSnap = false;
  let snappedThisAtom = false;

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

    const atomIdx = manual.getAtomIdx();
    if (atomIdx !== prevAtomIdx && atomIdx < SWEEP_TARGETS.length) {
      waitingToSnap = false;
      snappedThisAtom = false;
      prevAtomIdx = atomIdx;
    }

    const phase = manual.getPhase();
    if (phase === "gathering" && !waitingToSnap && atomIdx < SWEEP_TARGETS.length) {
      manual.handleKey(space, ctx);
      waitingToSnap = true;
    } else if (phase === "sweeping" && waitingToSnap && !snappedThisAtom) {
      // Target aperture position is a fraction of the current pile's cuttable range.
      const startCount = manual.getCurrentStartCount();
      const max = Math.max(1, startCount - 4);
      const target = Math.max(1, Math.round(SWEEP_TARGETS[atomIdx] * max));
      if (manual.getApertureLeft() >= target) {
        manual.handleKey(space, ctx);
        snappedThisAtom = true;
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
