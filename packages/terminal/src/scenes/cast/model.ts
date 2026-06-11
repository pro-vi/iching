// CastModel — mutable animation state for the casting ritual

import type { Cast, GlyphEntry } from "@iching/core";
import type { GlyphAnimator } from "../../glyph-anim/types.ts";

export interface LineAnimState {
  progress: number; // 0-1, line drawing progress
  settled: boolean;
  glowing: boolean;
  glowProgress: number; // 0-1 for changing line pulse
  markerVisible: boolean;
  morphProgress: number; // 0-1 for becoming morph
  morphComplete: boolean;
}

export type CoinPhase = "idle" | "spin" | "land" | "collapse" | "done";

export class CastModel {
  // Per-line state
  lines: LineAnimState[];

  // Coin animation
  coinPhase: CoinPhase;
  coinProgress: [number, number, number]; // 0-1 per coin
  coinResults: [boolean, boolean, boolean]; // true=heads(3), false=tails(2)
  activeLine: number; // which line is currently being cast (-1 = none)

  // Hexagram completion
  hexagramComplete: boolean;
  glowProgress: number; // 0-1 for whole-figure glow

  // Title reveal
  titleProgress: number; // 0-1
  subtitleText: string;

  // Morph
  morphProgress: number[]; // per changing line, 0-1
  morphComplete: boolean;
  becomingTitleProgress: number;

  // Side-by-side layout
  layout: "centered" | "splitting" | "side-by-side";
  splitProgress: number; // 0 (centered) to 1 (fully split)
  rightHexMorphProgress: number[]; // per changing line (indexed by changingPositions index)
  rightHexMorphComplete: boolean;

  // Prompt
  showPrompt: boolean;
  promptChoice: string | null;

  // Pace control during the reveal (mirrors the yarrow ritual)
  paused: boolean;
  speed: number;

  // Large glyph reveal
  glyphAnimator: GlyphAnimator | null;
  glyphAnimDone: boolean;
  primaryGlyphEntry: GlyphEntry | null;
  becomingGlyphEntry: GlyphEntry | null;

  // Interactive exploration (after becoming reveal)
  explorationMode: boolean;
  focusedHex: "primary" | "becoming";

  // Intention text for this cast
  intention?: string;

  // Reference to the cast data
  readonly cast: Cast;

  constructor(cast: Cast) {
    this.cast = cast;
    this.lines = Array.from({ length: 6 }, () => ({
      progress: 0,
      settled: false,
      glowing: false,
      glowProgress: 0,
      markerVisible: false,
      morphProgress: 0,
      morphComplete: false,
    }));

    this.coinPhase = "idle";
    this.coinProgress = [0, 0, 0];
    this.coinResults = [false, false, false];
    this.activeLine = -1;

    this.hexagramComplete = false;
    this.glowProgress = 0;

    this.titleProgress = 0;
    this.subtitleText = "";

    this.morphProgress = cast.changingPositions.map(() => 0);
    this.morphComplete = false;
    this.becomingTitleProgress = 0;

    this.layout = "centered";
    this.splitProgress = 0;
    this.rightHexMorphProgress = cast.changingPositions.map(() => 0);
    this.rightHexMorphComplete = false;

    this.showPrompt = false;
    this.promptChoice = null;

    this.paused = false;
    this.speed = 1;

    this.glyphAnimator = null;
    this.glyphAnimDone = false;
    this.primaryGlyphEntry = null;
    this.becomingGlyphEntry = null;

    this.explorationMode = false;
    this.focusedHex = "primary";
  }
}
