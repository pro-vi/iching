// Web playback of a recorded iching cast ritual, via the wterm emulator.
//
// Normal load: plays the recording on a loop.
// ?seek=<ms>:  writes every frame up to <ms> instantly, then stops — a
//              deterministic static frame for screenshot testing.

import { WTerm } from "@wterm/dom";

interface RecordingFrame {
  delayMs: number;
  data: string;
}

interface Recording {
  cols: number;
  rows: number;
  method: string;
  preset: string;
  theme: string;
  seed: number;
  init: string;
  frames: RecordingFrame[];
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const CLEAR_SCREEN = "\x1b[2J\x1b[H";

async function main(): Promise<void> {
  const el = document.getElementById("terminal");
  if (!el) throw new Error("missing #terminal element");

  const recording: Recording = await fetch("/recordings/yarrow.json").then(
    (r) => r.json(),
  );

  // Size the terminal BEFORE creating WTerm. Changing the font size after
  // init resizes the container, so wterm recomputes its grid and calls
  // setup() (container.innerHTML = "") every frame — a full-clear flicker.
  // Sizing up front means wterm initializes once at its final size and never
  // re-measures. Menlo advance width ≈ 0.62em, row height = 1.2em.
  const margin = 132; // leave a frame so the terminal reads as a card
  const byWidth = (window.innerWidth - margin) / (recording.cols * 0.62);
  const byHeight = (window.innerHeight - margin) / (recording.rows * 1.2);
  const fontSize = Math.max(8, Math.min(byWidth, byHeight, 30));
  el.style.setProperty("--term-font-size", `${fontSize}px`);
  el.style.setProperty("--term-row-height", `${fontSize * 1.2}px`);

  const term = new WTerm(el, {
    cols: recording.cols,
    rows: recording.rows,
    autoResize: false,
    cursorBlink: false,
    onData: () => {}, // replay only — swallow stray input
  });
  await term.init();

  const seek = new URLSearchParams(location.search).get("seek");
  if (seek !== null) {
    // Deterministic single frame: fast-forward to the requested time.
    const target = Number(seek);
    term.write(recording.init);
    let t = 0;
    for (const frame of recording.frames) {
      t += frame.delayMs;
      if (t > target) break;
      term.write(frame.data);
    }
    return;
  }

  // Looping playback.
  for (;;) {
    term.write(CLEAR_SCREEN);
    term.write(recording.init);
    for (const frame of recording.frames) {
      await sleep(frame.delayMs);
      term.write(frame.data);
    }
    await sleep(2600);
  }
}

main().catch((err) => {
  console.error(err);
  const el = document.getElementById("terminal");
  if (el) el.textContent = `playback error: ${String(err)}`;
});
