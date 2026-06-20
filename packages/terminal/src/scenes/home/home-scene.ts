// HomeScene — main menu: daily cast, dictionary, journal, quit

import type { Scene, SceneContext, SceneSignal } from "../../scene/types.ts";
import type { CellBuffer } from "../../render/buffer.ts";
import { type KeyEvent, isCtrlC } from "../../input/key-parser.ts";
import type { DailyCache } from "@iching/core";
import { GUA, toSimplified } from "@iching/core";
import { getTheme, type Theme } from "../../color/theme.ts";
import { stringWidth } from "../../layout/measure.ts";
import { renderTaijitu, type TaijituStyle } from "./taijitu-render.ts";
import { tr, type MessageKey } from "../../i18n/messages.ts";

export interface HomeState {
  todayCast: DailyCache | null;
  taijituStyle: TaijituStyle;
  devMode?: boolean;
}

/** The home menu — one source of truth for display (key, label, tone) and behavior
 *  (signal), with optional visibility. render() and handleKey() both read it, so a
 *  shown key always has a handler and a handled key is always shown. */
const MENU: {
  key: string;
  msgKey: MessageKey;
  tone: keyof Theme;
  signal: SceneSignal;
  show?: (state: HomeState) => boolean;
}[] = [
  { key: "c", msgKey: "menu.cast", tone: "accent", signal: { type: "startCast" } },
  { key: "p", msgKey: "menu.play", tone: "secondary", signal: { type: "startPlay" }, show: (s) => Boolean(s.devMode) },
  { key: "t", msgKey: "menu.today", tone: "primary", signal: { type: "openToday" }, show: (s) => s.todayCast !== null },
  { key: "d", msgKey: "menu.dictionary", tone: "primary", signal: { type: "openDictionary" } },
  { key: "j", msgKey: "menu.journal", tone: "secondary", signal: { type: "openJournal" } },
  { key: "s", msgKey: "menu.settings", tone: "secondary", signal: { type: "openSettings" } },
  { key: "q", msgKey: "menu.quit", tone: "tertiary", signal: { type: "exit" } },
];

export class HomeScene implements Scene {
  private state: HomeState;
  private elapsed = 0;

  constructor(state: HomeState) {
    this.state = state;
  }

  setTaijituStyle(style: TaijituStyle): void {
    this.state.taijituStyle = style;
  }

  enter(_ctx: SceneContext): void {}

  update(elapsed: number, _dt: number, _ctx: SceneContext): void {
    this.elapsed = elapsed;
  }

  render(frame: CellBuffer, ctx: SceneContext): void {
    const t = getTheme();
    const lang = ctx.language ?? "en";
    const cn = (s: string): string => (lang === "zh-Hans" ? toSimplified(s) : s);
    const cx = Math.floor(frame.width / 2);
    const titleRow = Math.floor(frame.height / 2) - 6;
    let row = titleRow;

    // Rotating taijitu fills the space above the title (1 row top margin, 2 row gap before title)
    const maxRfromHeight = titleRow - 6;
    const maxRfromWidth = Math.floor(frame.width / 2) - 2;
    const radius = Math.min(maxRfromHeight, maxRfromWidth);
    if (radius >= 4) {
      const centerRow = (titleRow - 2) / 2;
      renderTaijitu(frame, cx, centerRow, radius, this.elapsed * 0.0004, this.state.taijituStyle);
    }

    // Title
    const title = "☯  I Ching";
    const titleCol = cx - Math.floor(stringWidth(title) / 2);
    frame.writeText(row, titleCol, title, { fg: t.primary, bold: true });
    row += 3;

    // Menu items. "Today" appears only once a reading exists for the day —
    // returning to sit with it is the most common daily action after the cast.
    for (const item of MENU) {
      if (item.show && !item.show(this.state)) continue;
      const label = tr(lang, item.msgKey);
      const text = `[${item.key}]  ${label}`;
      const col = cx - Math.floor(stringWidth(text) / 2);
      frame.writeText(row, col, `[${item.key}]`, { fg: t.tertiary });
      frame.writeText(row, col + stringWidth(`[${item.key}]`) + 1, ` ${label}`, { fg: t[item.tone] });
      row += 2;
    }

    // Today's cast status
    row += 1;
    if (this.state.todayCast) {
      const gua = GUA[this.state.todayCast.cast.primary - 1];
      const status = `${tr(lang, "home.today")} ${gua.u} ${cn(gua.n)} (${gua.p})`;
      const statusCol = cx - Math.floor(stringWidth(status) / 2);
      frame.writeText(row, statusCol, status, { fg: t.secondary, dim: true });

      if (this.state.todayCast.cast.becoming !== null) {
        row += 1;
        const bg = GUA[this.state.todayCast.cast.becoming - 1];
        const becoming = `→ ${bg.u} ${cn(bg.n)}`;
        const bCol = cx - Math.floor(stringWidth(becoming) / 2);
        frame.writeText(row, bCol, becoming, { fg: t.tertiary, dim: true });
      }
    } else {
      const nocast = tr(lang, "home.noCast");
      const ncCol = cx - Math.floor(stringWidth(nocast) / 2);
      frame.writeText(row, ncCol, nocast, { fg: t.tertiary, dim: true });
    }
  }

  handleKey(key: KeyEvent, _ctx: SceneContext): SceneSignal | void {
    if (key.type === "char") {
      const item = MENU.find((m) => m.key === key.char);
      if (item && (!item.show || item.show(this.state))) return item.signal;
    }
    if (isCtrlC(key)) return { type: "exit" };
    // Escape is deliberately a no-op on Home: everywhere else it means "back",
    // so a habitual extra esc after backing out of a scene must not kill the
    // session. q and Ctrl+C remain the exits.
  }
}
