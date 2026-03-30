// JournalScene — placeholder for journal list/detail viewer

import type { Scene, SceneContext, SceneSignal } from "../../scene/types.ts";
import type { CellBuffer } from "../../render/buffer.ts";
import type { KeyEvent } from "../../input/key-parser.ts";
import { TEMPLE_NIGHT } from "../../color/themes/temple-night.ts";
import { stringWidth } from "../../layout/measure.ts";

/**
 * Placeholder journal scene.
 * Will eventually show a scrollable list of past readings.
 */
export class JournalScene implements Scene {
  update(_elapsed: number, _dt: number, _ctx: SceneContext): void {
    // Static placeholder
  }

  render(frame: CellBuffer, _ctx: SceneContext): void {
    const text = "Journal — coming soon";
    const row = Math.floor(frame.height / 2);
    const w = stringWidth(text);
    const col = Math.max(0, Math.floor((frame.width - w) / 2));
    frame.writeText(row, col, text, { fg: TEMPLE_NIGHT.stone });

    const hint = "[q] back";
    const hintRow = row + 2;
    const hw = stringWidth(hint);
    const hcol = Math.max(0, Math.floor((frame.width - hw) / 2));
    frame.writeText(hintRow, hcol, hint, { fg: TEMPLE_NIGHT.ash });
  }

  handleKey(key: KeyEvent, _ctx: SceneContext): SceneSignal | void {
    if (key.type === "char" && key.char === "q") {
      return "exit";
    }
    if (key.type === "ctrl" && key.char === "c") {
      return "exit";
    }
  }
}
