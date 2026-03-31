// HomeScene — main menu: daily cast, dictionary, journal, quit

import type { Scene, SceneContext, SceneSignal } from "../../scene/types.ts";
import type { CellBuffer } from "../../render/buffer.ts";
import type { KeyEvent } from "../../input/key-parser.ts";
import type { DailyCache } from "@iching/core";
import { GUA } from "@iching/core";
import { getTheme } from "../../color/theme.ts";
import { stringWidth } from "../../layout/measure.ts";

export interface HomeState {
  todayCast: DailyCache | null;
}

export class HomeScene implements Scene {
  private state: HomeState;

  constructor(state: HomeState) {
    this.state = state;
  }

  enter(_ctx: SceneContext): void {}

  update(_elapsed: number, _dt: number, _ctx: SceneContext): void {}

  render(frame: CellBuffer, _ctx: SceneContext): void {
    const t = getTheme();
    const cx = Math.floor(frame.width / 2);
    let row = Math.floor(frame.height / 2) - 6;

    // Title
    const title = "☯  I Ching";
    const titleCol = cx - Math.floor(stringWidth(title) / 2);
    frame.writeText(row, titleCol, title, { fg: t.primary, bold: true });
    row += 3;

    // Menu items
    const items = [
      { key: "c", label: "Daily Cast", fg: t.accent },
      { key: "d", label: "Dictionary", fg: t.primary },
      { key: "j", label: "Journal", fg: t.secondary },
      { key: "s", label: "Settings", fg: t.secondary },
      { key: "q", label: "Quit", fg: t.tertiary },
    ];

    for (const item of items) {
      const text = `[${item.key}]  ${item.label}`;
      const col = cx - Math.floor(stringWidth(text) / 2);
      frame.writeText(row, col, `[${item.key}]`, { fg: t.tertiary });
      frame.writeText(row, col + stringWidth(`[${item.key}]`) + 1, ` ${item.label}`, { fg: item.fg });
      row += 2;
    }

    // Today's cast status
    row += 1;
    if (this.state.todayCast) {
      const gua = GUA[this.state.todayCast.cast.primary - 1];
      const status = `Today: ${gua.u} ${gua.n} (${gua.p})`;
      const statusCol = cx - Math.floor(stringWidth(status) / 2);
      frame.writeText(row, statusCol, status, { fg: t.secondary, dim: true });

      if (this.state.todayCast.cast.becoming !== null) {
        row += 1;
        const bg = GUA[this.state.todayCast.cast.becoming - 1];
        const becoming = `→ ${bg.u} ${bg.n}`;
        const bCol = cx - Math.floor(stringWidth(becoming) / 2);
        frame.writeText(row, bCol, becoming, { fg: t.tertiary, dim: true });
      }
    } else {
      const nocast = "No cast today";
      const ncCol = cx - Math.floor(stringWidth(nocast) / 2);
      frame.writeText(row, ncCol, nocast, { fg: t.tertiary, dim: true });
    }
  }

  handleKey(key: KeyEvent, _ctx: SceneContext): SceneSignal | void {
    if (key.type === "char") {
      switch (key.char) {
        case "c": return { goto: "cast" };
        case "d": return { goto: "dictionary" };
        case "j": return { goto: "journal" };
        case "s": return { goto: "settings" };
        case "q": return "exit";
      }
    }
    if (key.type === "ctrl" && key.char === "c") return "exit";
    if (key.type === "escape") return "exit";
  }
}
