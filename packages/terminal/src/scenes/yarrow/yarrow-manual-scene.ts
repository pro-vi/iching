// YarrowManualScene — 18-cut full manual yarrow.
//
// Eighteen sweep-and-snap gestures per cast: one per round (3 rounds × 6 lines).
// A 4-stalk-wide aperture sweeps L↔R across the current pile (49 → ~40 → ~32
// across the line). The operator taps Space to snap the aperture; the system
// picks a uniform-random k from the 4-stalk window and uses it as that
// round's split. This preserves the authored-cut ritual arithmetic; the
// distribution depends on where the operator snaps the aperture.
//
// The operator authors WHERE to cut at every round. Rounds are computed
// incrementally as the user snaps — the line value isn't known until round 3
// commits.

import {
  castYarrowRound,
  CryptoRandomSource,
  lineFromValue,
  toLineValue,
  type RandomSource,
  type YarrowLineResult,
  type YarrowRound,
} from "@iching/core";
import type { Scene, SceneContext, SceneSignal } from "../../scene/types.ts";
import type { CellBuffer } from "../../render/buffer.ts";
import type { KeyEvent } from "../../input/key-parser.ts";
import type { MotionPreset } from "../../animation/presets.ts";
import { getYarrowTiming } from "../../animation/yarrow-presets.ts";
import type { YarrowTiming, RitualDetail } from "../../animation/yarrow-presets.ts";
import { TimelineRunner } from "../../animation/runner.ts";
import { type Step, seq } from "../../animation/timeline.ts";
import { YarrowModel } from "./model.ts";
import {
  renderYarrowField,
  yarrowFieldGeometry,
  drawApertureCursor,
  bounceAperture,
} from "./field-renderer.ts";
import { writeChromeFooter } from "../cast/ritual-chrome.ts";
import { tr } from "../../i18n/messages.ts";
import type { DisplayLanguage } from "@iching/core";
import {
  buildYarrowRoundBeats,
  buildYarrowFuseBeat,
} from "./yarrow-timeline.ts";

const LINES = 6;
const ROUNDS_PER_LINE = 3;
const TOTAL_ATOMS = LINES * ROUNDS_PER_LINE; // 18
const APERTURE_WIDTH = 4;
const APERTURE_MIN = 1;
const SWEEP_INTERVAL_MS = 150;     // ms per cell of aperture travel
const SNAP_HOLD_MS = 250;          // brief beat after snap before round plays

type Phase = "gathering" | "sweeping" | "snapping" | "playing" | "complete";
type SweepDir = 1 | -1;

export class YarrowManualScene implements Scene {
  private readonly model: YarrowModel;
  private readonly source: RandomSource;
  private readonly timing: YarrowTiming;
  private readonly detail: RitualDetail;

  private phase: Phase = "gathering";
  private atomIdx = 0;                  // 0..17 — three per line, six lines

  // Per-line buffer of rounds as they commit; promoted to model.transcript
  // and finalized into a Line when round 3 lands.
  private currentLineRounds: YarrowRound[] = [];

  // Aperture state during sweeping; varies per round because pile size shrinks.
  private apertureLeft = APERTURE_MIN;
  private sweepDir: SweepDir = 1;
  private sweepAccumMs = 0;
  private snapHoldMs = 0;
  private committedK = 0;               // last committed k — for tests / provenance

  private subRunner: TimelineRunner | null = null;
  private subElapsed = 0;

  private readonly language: DisplayLanguage;

  constructor(motion: MotionPreset = "default", source?: RandomSource, language: DisplayLanguage = "en") {
    this.model = new YarrowModel(null);
    this.source = source ?? new CryptoRandomSource();
    this.language = language;
    const resolved = getYarrowTiming(motion);
    this.timing = resolved.timing;
    this.detail = resolved.detail;
  }

  enter(_ctx: SceneContext): void {
    this.model.resetActiveLine(0);
  }

  update(_elapsed: number, dt: number, _ctx: SceneContext): void {
    if (this.phase === "sweeping") {
      this.sweepAccumMs += dt;
      while (this.sweepAccumMs >= SWEEP_INTERVAL_MS) {
        this.sweepAccumMs -= SWEEP_INTERVAL_MS;
        this.advanceAperture();
      }
      return;
    }
    if (this.phase === "snapping") {
      this.snapHoldMs += dt;
      if (this.snapHoldMs >= SNAP_HOLD_MS) this.commitCut();
      return;
    }
    if (this.phase === "playing" && this.subRunner) {
      this.subElapsed += dt;
      const done = this.subRunner.advance(this.subElapsed, this.model);
      if (done) this.advanceToNextAtom();
    }
  }

  render(frame: CellBuffer, _ctx: SceneContext): void {
    renderYarrowField(frame, this.model, this.language);
    if (this.phase === "sweeping" || this.phase === "snapping") {
      const g = yarrowFieldGeometry(frame);
      drawApertureCursor(
        frame, g.fieldRow, g.center, this.apertureLeft,
        APERTURE_WIDTH, this.currentStartCount(),
      );
    }
    this.renderFooter(frame, this.language);
  }

  handleKey(key: KeyEvent, _ctx: SceneContext): SceneSignal | void {
    if (key.type === "ctrl" && key.char === "c") return { type: "exit" };

    if (key.type === "escape") {
      if (this.phase === "sweeping" || this.phase === "snapping") {
        // Cancel back to gathering for the same round.
        this.resetSweepState();
        this.phase = "gathering";
        return;
      }
      return { type: "home" };
    }

    if (key.type === "char" && key.char === "q") return { type: "home" };
    if (key.type !== "char" || key.char !== " ") return;

    switch (this.phase) {
      case "gathering":
        // Start the sweep at the left edge of the current pile.
        this.apertureLeft = APERTURE_MIN;
        this.sweepDir = 1;
        this.sweepAccumMs = 0;
        this.phase = "sweeping";
        break;
      case "sweeping":
        // Snap. Aperture freezes; SNAP_HOLD_MS later the round plays.
        this.snapHoldMs = 0;
        this.phase = "snapping";
        break;
      case "snapping":
      case "playing":
        // Ignore mid-action input.
        break;
      case "complete":
        return { type: "yarrowCompleted", cast: this.model.requireCast() };
    }
  }

  /** Bounce-sweep — delegated to the shared atom; max varies per round. */
  private advanceAperture(): void {
    [this.apertureLeft, this.sweepDir] = bounceAperture(
      this.apertureLeft, this.sweepDir, APERTURE_MIN, this.apertureMax(),
    );
  }

  /**
   * Snap completes — pick a uniform-random k inside the aperture window,
   * compute the round via the core helper, and start playing it.
   */
  private commitCut(): void {
    const startCount = this.currentStartCount();
    const max = this.apertureMax();
    const left = Math.max(APERTURE_MIN, Math.min(max, this.apertureLeft));
    const offset = this.source.nextBytes(1)[0] % APERTURE_WIDTH;
    const k = left + offset;
    this.committedK = k;

    const round = castYarrowRound(this.source, startCount, { splitAt: k });
    this.currentLineRounds.push(round);

    const lineIdx = Math.floor(this.atomIdx / ROUNDS_PER_LINE);
    const roundIdx = this.atomIdx % ROUNDS_PER_LINE;

    // Make the round visible to the renderer + beat builders by promoting it
    // into the transcript as it lands. Round 2 also finalizes the line value
    // and assembles the YarrowLineResult.
    this.ensureTranscriptSlot(lineIdx);
    this.model.transcript[lineIdx].rounds[roundIdx] = round;

    // Narrate the post-cut math (takeOne / count / tally / carry / fuse) so
    // the operator who authored the cut sees the outcome arithmetic — but
    // suppress the divide caption that would name k explicitly. Phase-driven
    // narration, not mode-driven: agency over the cut doesn't make the
    // arithmetic self-evident.
    const beats: Step[] = buildYarrowRoundBeats(
      this.model, this.timing, this.detail, lineIdx, roundIdx, round,
      { narrating: true, revealCut: false, language: this.language },
    );

    if (roundIdx === ROUNDS_PER_LINE - 1) {
      // Final round of this line — derive the line value and append the
      // line's fuse beat so the line lands visually before the next gather.
      const line = lineFromValue(toLineValue(round.remaining / 4));
      this.model.transcript[lineIdx].line = line;
      this.currentLineRounds = [];
      beats.push(buildYarrowFuseBeat(this.model, this.timing, lineIdx, { narrating: true }));
    }

    this.subRunner = new TimelineRunner(seq(...beats));
    this.subElapsed = 0;
    this.phase = "playing";
  }

  private advanceToNextAtom(): void {
    this.atomIdx++;
    this.subRunner = null;
    this.subElapsed = 0;
    this.resetSweepState();

    if (this.atomIdx >= TOTAL_ATOMS) {
      this.model.commitCast();
      this.phase = "complete";
      this.model.activeLine = -1;
      this.model.hexagramComplete = true;
      this.model.caption = "";
      return;
    }

    this.phase = "gathering";
    const lineIdx = Math.floor(this.atomIdx / ROUNDS_PER_LINE);
    const roundIdx = this.atomIdx % ROUNDS_PER_LINE;
    this.model.activeLine = lineIdx;
    this.model.activeRound = roundIdx;
    this.model.beat = "gather";
    this.model.fieldCount = this.currentStartCount();
    this.model.splitProgress = 0;
    this.model.takeOneProgress = 0;
    this.model.countProgress = 0;
    this.model.tallyProgress = 0;
    this.model.carryProgress = 0;
    this.model.caption = "";
  }

  /** Pile size for the upcoming round — 49 for round 0, else previous round's remaining. */
  private currentStartCount(): number {
    const roundIdx = this.atomIdx % ROUNDS_PER_LINE;
    if (roundIdx === 0) return 49;
    const prev = this.currentLineRounds[roundIdx - 1];
    return prev ? prev.remaining : 49;
  }

  private apertureMax(): number {
    // k must be in [1, startCount - 1]; aperture covers k..k+APERTURE_WIDTH-1.
    return Math.max(APERTURE_MIN, this.currentStartCount() - APERTURE_WIDTH);
  }

  /** Pre-create a placeholder transcript entry so per-round mutation works. */
  private ensureTranscriptSlot(lineIdx: number): void {
    while (this.model.transcript.length <= lineIdx) {
      // Placeholder: rounds will be filled in as they commit; line set on round 3.
      this.model.transcript.push({
        rounds: [] as unknown as YarrowLineResult["rounds"],
        line: null as unknown as YarrowLineResult["line"],
      });
    }
  }

  private resetSweepState(): void {
    this.apertureLeft = APERTURE_MIN;
    this.sweepDir = 1;
    this.sweepAccumMs = 0;
    this.snapHoldMs = 0;
  }

  private renderFooter(frame: CellBuffer, lang: DisplayLanguage): void {
    // The line/round counter already lives in the chrome header (field-
    // renderer's renderChrome at row 1). The footer carries only the
    // phase-appropriate action prompt — duplicating the position info
    // here is dead text. Key-hint [key] verb form, normalized across languages.
    let text: string;
    switch (this.phase) {
      case "complete":
        text = `[space] ${tr(lang, "verb.receiveReading")}  ·  [esc] ${tr(lang, "verb.discard")}`;
        break;
      case "gathering":
        text = `[space] ${tr(lang, "verb.beginCutting")}  ·  [esc] ${tr(lang, "verb.back")}`;
        break;
      case "sweeping":
        text = `[space] ${tr(lang, "verb.cut")}`;
        break;
      case "snapping":
        text = tr(lang, "verb.cutAroundHere");
        break;
      case "playing":
        text = "";
        break;
    }
    writeChromeFooter(frame, text);
  }

  // ── Test accessors ───────────────────────────────────────────────────────

  getModel(): YarrowModel {
    return this.model;
  }
  getPhase(): Phase {
    return this.phase;
  }
  getAtomIdx(): number {
    return this.atomIdx;
  }
  getLineIdx(): number {
    return Math.floor(this.atomIdx / ROUNDS_PER_LINE);
  }
  getRoundIdx(): number {
    return this.atomIdx % ROUNDS_PER_LINE;
  }
  getApertureLeft(): number {
    return this.apertureLeft;
  }
  getCommittedK(): number {
    return this.committedK;
  }
  getCurrentStartCount(): number {
    return this.currentStartCount();
  }
}
