// BrowseScene — scrollable list of 64 hexagrams with live search

import type { Scene, SceneContext, SceneSignal } from "../../scene/types.ts";
import type { CellBuffer } from "../../render/buffer.ts";
import type { KeyEvent } from "../../input/key-parser.ts";
import { BrowseModel } from "./browse-model.ts";
import { TextInput } from "../../widgets/text-input.ts";
import { renderBrowse, listViewportHeight } from "./browse-renderer.ts";

export class BrowseScene implements Scene {
  private model: BrowseModel;
  private textInput: TextInput;

  constructor() {
    this.model = new BrowseModel();
    this.textInput = new TextInput();
  }

  enter(ctx: SceneContext): void {
    this.model.viewportHeight = listViewportHeight(ctx.rows);
  }

  update(_elapsed: number, _dt: number, _ctx: SceneContext): void {
    // Static scene — no time-based updates
  }

  render(frame: CellBuffer, ctx: SceneContext): void {
    renderBrowse(frame, this.model, this.textInput, ctx);
  }

  resize(_cols: number, rows: number): void {
    this.model.viewportHeight = listViewportHeight(rows);
  }

  handleKey(key: KeyEvent, _ctx: SceneContext): SceneSignal | void {
    // Exit keys
    if (key.type === "char" && key.char === "q" && !this.model.searchActive) {
      return "exit";
    }
    if (key.type === "ctrl" && key.char === "c") {
      return "exit";
    }

    // Escape
    if (key.type === "escape") {
      if (this.model.searchActive) {
        this.model.searchActive = false;
        this.textInput.clear();
        this.model.setQuery("");
        return;
      }
      return { goto: "back" };
    }

    // Enter — open detail for selected hexagram
    if (key.type === "enter") {
      const kw = this.model.selectedKW();
      if (kw !== undefined) {
        return { goto: `detail:${kw}` };
      }
      return;
    }

    // Navigation
    if (key.type === "arrow") {
      if (key.direction === "up") {
        this.model.cursorUp();
        return;
      }
      if (key.direction === "down") {
        this.model.cursorDown();
        return;
      }
    }

    if (key.type === "page") {
      if (key.direction === "up") this.model.pageUp();
      if (key.direction === "down") this.model.pageDown();
      return;
    }

    if (key.type === "home") {
      this.model.cursor = 0;
      this.model.scrollOffset = 0;
      return;
    }

    if (key.type === "end") {
      this.model.cursor = Math.max(0, this.model.filtered.length - 1);
      this.model.scrollOffset = Math.max(
        0,
        this.model.filtered.length - this.model.viewportHeight,
      );
      return;
    }

    // Search activation
    if (key.type === "char" && key.char === "/" && !this.model.searchActive) {
      this.model.searchActive = true;
      return;
    }

    // Backspace in search mode
    if (key.type === "backspace" && this.model.searchActive) {
      this.textInput.backspace();
      this.model.setQuery(this.textInput.value);
      return;
    }

    // Type characters — activate search if not active, add to query
    if (key.type === "char" && key.char !== "q") {
      if (!this.model.searchActive) {
        this.model.searchActive = true;
      }
      this.textInput.insert(key.char);
      this.model.setQuery(this.textInput.value);
      return;
    }

    // q in search mode is a regular character
    if (key.type === "char" && key.char === "q" && this.model.searchActive) {
      this.textInput.insert(key.char);
      this.model.setQuery(this.textInput.value);
      return;
    }
  }

  /** Expose model for testing */
  getModel(): BrowseModel {
    return this.model;
  }
}
