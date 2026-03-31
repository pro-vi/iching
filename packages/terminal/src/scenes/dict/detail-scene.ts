// DetailScene — full hexagram reference view

import type { Scene, SceneContext, SceneSignal } from "../../scene/types.ts";
import type { CellBuffer } from "../../render/buffer.ts";
import type { KeyEvent } from "../../input/key-parser.ts";
import { DetailModel } from "./detail-model.ts";
import { renderDetail } from "./detail-renderer.ts";

const FOOTER_ROWS = 2;

export class DetailScene implements Scene {
  private model: DetailModel;

  constructor(kw: number) {
    this.model = new DetailModel(kw);
  }

  enter(ctx: SceneContext): void {
    this.model.viewportHeight = ctx.rows - FOOTER_ROWS;
  }

  update(_elapsed: number, _dt: number, _ctx: SceneContext): void {
    // Static scene
  }

  render(frame: CellBuffer, ctx: SceneContext): void {
    renderDetail(frame, this.model, ctx);
  }

  resize(_cols: number, rows: number): void {
    this.model.viewportHeight = rows - FOOTER_ROWS;
  }

  handleKey(key: KeyEvent, _ctx: SceneContext): SceneSignal | void {
    // Exit
    if (key.type === "char" && key.char === "q") {
      return "exit";
    }
    if (key.type === "ctrl" && key.char === "c") {
      return "exit";
    }

    // Back
    if (key.type === "escape" || key.type === "backspace") {
      return { goto: "back" };
    }

    // Tab — toggle focus
    if (key.type === "tab") {
      this.model.focus =
        this.model.focus === "content" ? "derived" : "content";
      return;
    }

    // Arrow keys
    if (key.type === "arrow") {
      if (key.direction === "up") {
        if (this.model.focus === "derived") {
          this.model.derivedUp();
        } else {
          this.model.scrollUp();
        }
        return;
      }
      if (key.direction === "down") {
        if (this.model.focus === "derived") {
          this.model.derivedDown();
        } else {
          this.model.scrollDown();
        }
        return;
      }
    }

    // Page up/down
    if (key.type === "page") {
      if (key.direction === "up") this.model.pageUp();
      if (key.direction === "down") this.model.pageDown();
      return;
    }

    // Home/End
    if (key.type === "home") {
      this.model.scrollOffset = 0;
      return;
    }
    if (key.type === "end") {
      this.model.scrollOffset = Math.max(
        0,
        this.model.contentHeight - this.model.viewportHeight,
      );
      return;
    }

    // Enter — navigate to derived hexagram
    if (key.type === "enter" && this.model.focus === "derived") {
      const kw = this.model.selectedDerivedKW();
      return { goto: `detail:${kw}` };
    }
  }

  /** Expose model for testing */
  getModel(): DetailModel {
    return this.model;
  }

  /** Set history info (called by entry point after querying journal) */
  setHistory(castCount: number, lastCastDate: string | null): void {
    this.model.castCount = castCount;
    this.model.lastCastDate = lastCastDate;
  }
}
