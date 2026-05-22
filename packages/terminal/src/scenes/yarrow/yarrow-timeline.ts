// Yarrow timeline builder — composes the 18-round ritual from the transcript.
//
// Six lines, three rounds each, seven beats per round, then a fuse that turns
// the surviving field into the hexagram line. The first round of the first
// line is narrated with on-screen captions (teach-once); the first line is
// always animated in `expanded` detail regardless of preset.

import { type Step, seq, call, tween, wait, stepDuration } from "../../animation/timeline.ts";
import { type EasingFn, linear, easeOut, easeInOut } from "../../animation/easing.ts";
import type { YarrowTiming, RitualDetail } from "../../animation/yarrow-presets.ts";
import type { YarrowModel } from "./model.ts";

/** Stepwise easing — the `expanded` count peels groups in discrete jumps. */
const staircase: EasingFn = (t) => Math.min(1, Math.ceil(t * 10) / 10);

/** Teach-once captions, shown only on the first round of the first line. */
const CAPTIONS = {
  gather: "The field rests.",
  divide: "Divide at a random point.",
  takeOne: "Set one stalk aside.",
  count: "Count each heap by fours.",
  tally: "What is removed is the tally.",
  carry: "Carry the remainder onward.",
  fuse: "The remainder becomes the line.",
} as const;

export interface YarrowTimeline {
  /** The composed ritual timeline. */
  timeline: Step;
  /** Cumulative end-time of each beat, in playback order — for pace stepping. */
  beatOffsets: number[];
}

/**
 * Build the full yarrow ritual timeline. The timeline closes over `model` and
 * mutates its live state; `fastForward` lands the completed hexagram.
 */
export function buildYarrowTimeline(
  model: YarrowModel,
  timing: YarrowTiming,
  detail: RitualDetail,
): YarrowTimeline {
  const beats: Step[] = [];

  // A narrated beat's caption lingers an extra captionHoldMs so it can be read.
  const hold = (caption: string): Step[] =>
    caption ? [wait(timing.captionHoldMs)] : [];

  for (let lineIdx = 0; lineIdx < 6; lineIdx++) {
    const teach = lineIdx === 0;
    // Teach-once: the first line is always expanded, whatever the preset.
    const effectiveDetail: RitualDetail = teach ? "expanded" : detail;
    const countEasing: EasingFn =
      effectiveDetail === "expanded"
        ? staircase
        : effectiveDetail === "summarized"
          ? easeInOut
          : linear;

    for (let roundIdx = 0; roundIdx < 3; roundIdx++) {
      const round = model.transcript[lineIdx].rounds[roundIdx];
      // Captions appear once — the first round teaches the round's shape.
      const narrating = lineIdx === 0 && roundIdx === 0;
      const caption = (key: keyof typeof CAPTIONS): string =>
        narrating ? CAPTIONS[key] : "";

      const gatherCap = caption("gather");
      beats.push(
        seq(
          call(() => {
            model.beat = "gather";
            model.activeLine = lineIdx;
            model.activeRound = roundIdx;
            model.fieldCount = round.startCount;
            model.splitProgress = 0;
            model.takeOneProgress = 0;
            model.countProgress = 0;
            model.tallyProgress = 0;
            model.carryProgress = 0;
            model.caption = gatherCap;
          }),
          wait(timing.gatherMs),
          ...hold(gatherCap),
          wait(timing.beatGapMs),
        ),
      );

      const divideCap = caption("divide");
      beats.push(
        seq(
          call(() => {
            model.beat = "divide";
            model.caption = divideCap;
          }),
          tween(timing.divideMs, (p) => {
            model.splitProgress = p;
          }, easeInOut),
          call(() => {
            model.splitProgress = 1;
          }),
          ...hold(divideCap),
          wait(timing.beatGapMs),
        ),
      );

      const takeOneCap = caption("takeOne");
      beats.push(
        seq(
          call(() => {
            model.beat = "takeOne";
            model.caption = takeOneCap;
          }),
          tween(timing.takeOneMs, (p) => {
            model.takeOneProgress = p;
          }, easeOut),
          call(() => {
            model.takeOneProgress = 1;
          }),
          ...hold(takeOneCap),
          wait(timing.beatGapMs),
        ),
      );

      const countCap = caption("count");
      beats.push(
        seq(
          call(() => {
            model.beat = "count";
            model.caption = countCap;
          }),
          tween(timing.countMs, (p) => {
            model.countProgress = p;
          }, countEasing),
          call(() => {
            model.countProgress = 1;
          }),
          ...hold(countCap),
          wait(timing.beatGapMs),
        ),
      );

      const tallyCap = caption("tally");
      beats.push(
        seq(
          call(() => {
            model.beat = "tally";
            model.caption = tallyCap;
          }),
          tween(timing.tallyHoldMs, (p) => {
            model.tallyProgress = p;
          }, easeOut),
          call(() => {
            model.tallyProgress = 1;
          }),
          ...hold(tallyCap),
          wait(timing.beatGapMs),
        ),
      );

      const carryCap = caption("carry");
      beats.push(
        seq(
          call(() => {
            model.beat = "carry";
            model.caption = carryCap;
          }),
          tween(timing.carryMs, (p) => {
            model.carryProgress = p;
          }, easeInOut),
          call(() => {
            model.carryProgress = 1;
            model.fieldCount = round.remaining;
          }),
          ...hold(carryCap),
          wait(timing.roundGapMs),
        ),
      );
    }

    // Fuse — the surviving field rises and condenses into the hexagram line.
    const line = model.transcript[lineIdx].line;
    const fuseCap = teach ? CAPTIONS.fuse : "";
    beats.push(
      seq(
        call(() => {
          model.beat = "fuse";
          model.caption = fuseCap;
        }),
        tween(timing.fuseMs, (p) => {
          model.lines[lineIdx].progress = p;
        }, easeOut),
        call(() => {
          model.lines[lineIdx].progress = 1;
          model.lines[lineIdx].settled = true;
          if (line.isChanging) model.lines[lineIdx].markerVisible = true;
        }),
        ...hold(fuseCap),
        call(() => {
          model.caption = "";
        }),
        wait(timing.lineSettleMs),
      ),
    );

    // Trigram-recognition pause once the lower trigram (lines 1-3) is complete.
    if (lineIdx === 2) beats.push(wait(timing.afterTrigramMs));
  }

  // Reveal bridge — hold the finished figure before handing off to the reveal.
  beats.push(
    seq(
      call(() => {
        model.beat = "done";
        model.activeLine = -1;
        model.hexagramComplete = true;
        model.caption = "";
      }),
      wait(timing.revealBridgeMs),
    ),
  );

  const beatOffsets: number[] = [];
  let acc = 0;
  for (const beat of beats) {
    acc += stepDuration(beat);
    beatOffsets.push(acc);
  }

  return { timeline: seq(...beats), beatOffsets };
}
