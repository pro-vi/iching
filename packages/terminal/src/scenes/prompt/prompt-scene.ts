// PromptScene — post-cast interactive prompt

import type { Scene, SceneContext, SceneSignal } from "../../scene/types.ts";
import type { CellBuffer } from "../../render/buffer.ts";
import type { KeyEvent } from "../../input/key-parser.ts";
import { TEMPLE_NIGHT } from "../../color/themes/temple-night.ts";
import { stringWidth } from "../../layout/measure.ts";

/**
 * Simple prompt scene showing:
 *   [enter] open reading   [j] journal   [q] quit
 *
 * Handles key input to return appropriate SceneSignals.
 */
export class PromptScene implements Scene {
  update(_elapsed: number, _dt: number, _ctx: SceneContext): void {
    // Static scene — no animation
  }

  render(frame: CellBuffer, _ctx: SceneContext): void {
    const text = "[enter] open reading   [j] journal   [q] quit";
    const row = Math.floor(frame.height / 2);
    const w = stringWidth(text);
    const col = Math.max(0, Math.floor((frame.width - w) / 2));
    frame.writeText(row, col, text, { fg: TEMPLE_NIGHT.ash });
  }

  handleKey(key: KeyEvent, _ctx: SceneContext): SceneSignal | void {
    if (key.type === "enter") {
      return { goto: "reading" };
    }
    if (key.type === "char" && key.char === "j") {
      return { goto: "journal" };
    }
    if (key.type === "char" && key.char === "q") {
      return "exit";
    }
    if (key.type === "ctrl" && key.char === "c") {
      return "exit";
    }
  }
}
