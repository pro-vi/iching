// Yarrow timeline builder — composes the 18-round ritual from the transcript.
//
// Six lines, three rounds each, seven beats per round, then a fuse that turns
// the surviving field into the hexagram line. The first round of the first
// line is narrated with on-screen captions (teach-once); the first line is
// always animated in `expanded` detail regardless of preset.

import { type Step, seq, call, tween, wait, stepDuration } from "../../animation/timeline.ts";
import { type EasingFn, linear, easeOut, easeInOut } from "../../animation/easing.ts";
import type { YarrowTiming, RitualDetail } from "../../animation/yarrow-presets.ts";
import type { YarrowRound } from "@iching/core";
import type { YarrowModel } from "./model.ts";

/** Stepwise easing — the `expanded` count peels groups in discrete jumps. */
const staircase: EasingFn = (t) => Math.min(1, Math.ceil(t * 10) / 10);

// Captions name the math, not just the action — so the on-screen motion
// connects to the original yarrow procedure. Numbers are pulled from the
// transcript round data. Line 0 (the first line) gets the full per-beat
// narration across all 3 rounds; every line's fuse names its value derivation.

interface RoundCaptions {
  gather: string;
  divide: string;
  takeOne: string;
  count: string;
  tally: string;
  carry: string;
}

const LINE_VALUE_NAMES: Record<6 | 7 | 8 | 9, string> = {
  6: "old yin",
  7: "young yang",
  8: "young yin",
  9: "old yang",
};

function buildRoundCaptions(
  roundIdx: number,
  round: { startCount: number; splitAt: number; leftRemainder: number; rightRemainder: number; setAside: number; remaining: number },
): RoundCaptions {
  const left = round.splitAt;
  const right = round.startCount - round.splitAt;
  // Round 1 setAside is 5 ("few", counts 3) or 9 ("many", counts 2);
  // rounds 2 & 3 are 4 ("few", 3) or 8 ("many", 2).
  const fewValue = roundIdx === 0 ? 5 : 4;
  const meaning = round.setAside === fewValue ? "few = 3" : "many = 2";
  const nextLabel = roundIdx === 2 ? "fuse" : `round ${roundIdx + 2}`;
  return {
    gather: `Round ${roundIdx + 1} · ${round.startCount} stalks`,
    divide: `Cut at k=${left} · heaps ${left} | ${right}`,
    takeOne: `One aside · heaps ${left} | ${right - 1}`,
    count: "Count each heap by fours.",
    tally: `1 + ${round.leftRemainder} + ${round.rightRemainder} = ${round.setAside} (${meaning})`,
    carry: `Carry ${round.remaining} → ${nextLabel}`,
  };
}

function buildFuseCaption(remaining: number): string {
  const value = (remaining / 4) as 6 | 7 | 8 | 9;
  return `Remaining ${remaining} ÷ 4 = ${value} · ${LINE_VALUE_NAMES[value]}`;
}

export interface YarrowTimeline {
  /** The composed ritual timeline. */
  timeline: Step;
  /** Cumulative end-time of each beat, in playback order — for pace stepping. */
  beatOffsets: number[];
}

/** Pick the count easing that matches a detail level. */
function countEasingForDetail(detail: RitualDetail): EasingFn {
  return detail === "expanded" ? staircase : detail === "summarized" ? easeInOut : linear;
}

/**
 * Build the six gather→divide→take→count→tally→carry beats for one round.
 * Returned as discrete Steps so a caller can compose them (full ritual) or
 * wrap them in a single seq() (manual scene playing one round at a time).
 *
 * The `round` parameter carries the data — auto callers pass it from the
 * fully-built `model.transcript[lineIdx].rounds[roundIdx]`; the 18-cut
 * manual scene passes the round it just computed from the user's snap,
 * before transcript is populated for that line.
 */
export function buildYarrowRoundBeats(
  model: YarrowModel,
  timing: YarrowTiming,
  detail: RitualDetail,
  lineIdx: number,
  roundIdx: number,
  round: YarrowRound,
  opts?: { narrating?: boolean; revealCut?: boolean },
): Step[] {
  const beats: Step[] = [];
  const hold = (caption: string): Step[] => (caption ? [wait(timing.captionHoldMs)] : []);
  const countEasing = countEasingForDetail(detail);
  const narrating = opts?.narrating ?? false;
  // Phase-driven secrecy: in manual mode the user authored the cut, so the
  // divide caption (which names k explicitly) is suppressed even when other
  // captions narrate. Auto mode passes revealCut: true so the cut k is named
  // alongside the divide animation.
  const revealCut = opts?.revealCut ?? true;
  const caps = buildRoundCaptions(roundIdx, round);
  const caption = (key: keyof RoundCaptions): string => {
    if (!narrating) return "";
    if (key === "divide" && !revealCut) return "";
    return caps[key];
  };

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
      // Gather motion settles, then hold a still "this is the pile" pose
      // — gives the eye a moment to register the heap's mass before the cut.
      wait(timing.gatherMs + timing.gatherHoldMs),
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
      tween(timing.divideMs, (p) => { model.splitProgress = p; }, easeInOut),
      call(() => { model.splitProgress = 1; }),
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
      tween(timing.takeOneMs, (p) => { model.takeOneProgress = p; }, easeOut),
      call(() => { model.takeOneProgress = 1; }),
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
      tween(timing.countMs, (p) => { model.countProgress = p; }, countEasing),
      call(() => { model.countProgress = 1; }),
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
      tween(timing.tallyHoldMs, (p) => { model.tallyProgress = p; }, easeOut),
      call(() => { model.tallyProgress = 1; }),
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
      tween(timing.carryMs, (p) => { model.carryProgress = p; }, easeInOut),
      call(() => {
        model.carryProgress = 1;
        model.fieldCount = round.remaining;
      }),
      ...hold(carryCap),
      wait(timing.roundGapMs),
    ),
  );

  return beats;
}

/**
 * Build the fuse beat that lifts a line's surviving field into the hexagram
 * line glyph. The derivation caption is shown only when narrating — the
 * teach-once line names its value out loud; subsequent lines land in silence
 * and let the motion say what it is.
 */
export function buildYarrowFuseBeat(
  model: YarrowModel,
  timing: YarrowTiming,
  lineIdx: number,
  opts?: { narrating?: boolean },
): Step {
  const line = model.transcript[lineIdx].line;
  const narrating = opts?.narrating ?? false;
  const hold = (caption: string): Step[] => (caption ? [wait(timing.captionHoldMs)] : []);
  const fuseCap = narrating ? buildFuseCaption(model.transcript[lineIdx].rounds[2].remaining) : "";
  return seq(
    call(() => {
      model.beat = "fuse";
      model.caption = fuseCap;
    }),
    tween(timing.fuseMs, (p) => { model.lines[lineIdx].progress = p; }, easeOut),
    call(() => {
      model.lines[lineIdx].progress = 1;
      model.lines[lineIdx].settled = true;
      if (line.isChanging) model.lines[lineIdx].markerVisible = true;
    }),
    ...hold(fuseCap),
    call(() => { model.caption = ""; }),
    wait(timing.lineSettleMs),
  );
}

/**
 * Build one line's full ritual beats: round 1 + round 2 + round 3 + fuse.
 * The 3-rounds-plus-fuse structure is the unit of yarrow ritual; both auto
 * (looped 6× inside `buildYarrowTimeline`) and H4 manual (called once per
 * user-committed cut) compose from this.
 */
export function buildYarrowFullLineBeats(
  model: YarrowModel,
  timing: YarrowTiming,
  detail: RitualDetail,
  lineIdx: number,
  opts?: { narrating?: boolean },
): Step[] {
  const rounds = model.transcript[lineIdx].rounds;
  return [
    ...buildYarrowRoundBeats(model, timing, detail, lineIdx, 0, rounds[0], opts),
    ...buildYarrowRoundBeats(model, timing, detail, lineIdx, 1, rounds[1], opts),
    ...buildYarrowRoundBeats(model, timing, detail, lineIdx, 2, rounds[2], opts),
    buildYarrowFuseBeat(model, timing, lineIdx, opts),
  ];
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

  for (let lineIdx = 0; lineIdx < 6; lineIdx++) {
    const teach = lineIdx === 0;
    // Teach-once: the first line is always expanded, whatever the preset.
    const effectiveDetail: RitualDetail = teach ? "expanded" : detail;
    const narrating = lineIdx === 0;

    beats.push(...buildYarrowFullLineBeats(model, timing, effectiveDetail, lineIdx, { narrating }));

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
