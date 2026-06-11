// Scene interface — lifecycle contract for terminal scenes

import type { Cast, DisplayLanguage } from "@iching/core";
import type { CellBuffer } from "../render/buffer.ts";
import type { KeyEvent } from "../input/key-parser.ts";
import type { ColorSupport } from "../color/detect.ts";

export interface SceneContext {
  cols: number;
  rows: number;
  colorSupport: ColorSupport;
  /**
   * Active display language for UI text. Set once from config when the scene
   * loop starts (defaults to "en" when unset, e.g. in tests). Scenes route
   * product-ui strings through the message catalog with this value.
   */
  language?: DisplayLanguage;
  /**
   * Runner-managed exit flag. Production scenes should return a SceneSignal
   * instead; this is exposed primarily for test scenes that need to terminate
   * the runner without going through the input queue.
   */
  done: boolean;
}

/**
 * Typed scene outcome. Scenes return a discriminated union instead of
 * stringly `goto` strings so the router and home loop get exhaustiveness
 * checking and so payloads (kw, key, cast) ride the type system.
 */
export type SceneSignal =
  // Universal lifecycle
  | { type: "exit" }              // Ctrl+C — kill the program
  | { type: "back" }              // pop one scene off the router stack
  | { type: "home" }              // unwind: leave nested router and return to home
  // Home-menu intents
  | { type: "startCast" }         // begin a real cast (auto or manual depending on saved mode)
  | { type: "startPlay" }         // begin the coin-toss sandbox (no persistence)
  | { type: "openToday" }         // reopen today's reading (replay from the daily cache)
  | { type: "openDictionary" }    // open the hexagram browser
  | { type: "openJournal" }       // open the past-readings journal
  | { type: "openSettings" }      // open the settings editor
  // Cast / dictionary navigation. changedPositions carries cast context:
  // when a detail view is opened from a cast with moving lines, those line
  // positions (1-6, bottom-up) are marked and their texts emphasized.
  // Dictionary browsing passes none.
  | { type: "openDetail"; kw: number; changedPositions?: number[] }
  | { type: "openJournalReading"; key: string }
  // Inner-flow events
  | { type: "intentionConfirmed" } // intention input completed
  | { type: "tossCompleted"; cast: Cast } // coin-toss ritual produced a cast
  | { type: "yarrowCompleted"; cast: Cast }; // yarrow stalk ritual produced a cast

export interface Scene {
  enter?(ctx: SceneContext): void | Promise<void>;
  update(elapsed: number, dt: number, ctx: SceneContext): void;
  render(frame: CellBuffer, ctx: SceneContext): void;
  handleKey?(key: KeyEvent, ctx: SceneContext): SceneSignal | void;
  resize?(cols: number, rows: number): void;
  exit?(ctx: SceneContext): void | Promise<void>;
}
