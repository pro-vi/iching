// IntentionScene — optional text entry before casting

import type { Scene, SceneContext, SceneSignal } from "../../scene/types.ts";
import type { CellBuffer } from "../../render/buffer.ts";
import type { KeyEvent } from "../../input/key-parser.ts";
import { stripTerminalControls } from "@iching/core";
import { TextInput } from "../../widgets/text-input.ts";
import { getTheme } from "../../color/theme.ts";
import { stringWidth } from "../../layout/measure.ts";
import { tr } from "../../i18n/messages.ts";

export class IntentionScene implements Scene {
  private textInput: TextInput;
  private intention: string | undefined;

  constructor() {
    this.textInput = new TextInput();
  }

  getIntention(): string | undefined {
    return this.intention;
  }

  enter(_ctx: SceneContext): void {}

  update(_elapsed: number, _dt: number, _ctx: SceneContext): void {}

  render(frame: CellBuffer, ctx: SceneContext): void {
    const t = getTheme();
    const lang = ctx.language ?? "en";
    const cx = Math.floor(frame.width / 2);

    const fieldWidth = Math.min(frame.width - 8, 60);
    const fieldCol = cx - Math.floor(fieldWidth / 2);

    // Allow input to grow vertically up to most of the screen
    const maxInputRows = Math.max(1, frame.height - 8);
    const inputRows = Math.min(maxInputRows, this.textInput.wrappedHeight(fieldWidth));

    // Vertical layout: prompt | gap | input(inputRows) | gap | hint
    const totalHeight = 1 + 1 + inputRows + 1 + 1;
    const top = Math.max(1, Math.floor((frame.height - totalHeight) / 2));

    const promptRow = top;
    const inputRow = promptRow + 2;
    const hintRow = inputRow + inputRows + 1;

    // Prompt — 問 is a canonical anchor, shown in all languages (Policy Matrix)
    const prompt = "問";
    const promptCol = cx - Math.floor(stringWidth(prompt) / 2);
    frame.writeText(promptRow, promptCol, prompt, { fg: t.primary });

    // Input field (wraps onto multiple rows)
    this.textInput.renderWrapped(frame, inputRow, fieldCol, fieldWidth, maxInputRows, {
      fg: t.primary,
      bg: t.bg,
    });

    // Hint (only render if it fits)
    if (hintRow < frame.height) {
      const hint = `[enter] ${tr(lang, "verb.confirm")}  ·  [esc] ${tr(lang, "verb.back")}`;
      const hintCol = cx - Math.floor(stringWidth(hint) / 2);
      frame.writeText(hintRow, hintCol, hint, { fg: t.tertiary, dim: true });
    }
  }

  handleKey(key: KeyEvent, _ctx: SceneContext): SceneSignal | void {
    if (key.type === "enter") {
      const trimmed = this.textInput.value.trim();
      this.intention = trimmed || undefined;
      return { type: "intentionConfirmed" };
    }

    if (key.type === "escape") {
      // Cancel the cast and return to the home menu (not a program exit).
      return { type: "home" };
    }

    if (key.type === "ctrl" && key.char === "c") {
      return { type: "exit" };
    }

    if (key.type === "arrow") {
      if (key.direction === "left") this.textInput.moveCursorLeft();
      if (key.direction === "right") this.textInput.moveCursorRight();
      return;
    }

    if (key.type === "backspace") {
      this.textInput.backspace();
      return;
    }

    if (key.type === "delete") {
      this.textInput.delete();
      return;
    }

    if (key.type === "char") {
      this.textInput.insert(key.char);
      return;
    }

    if (key.type === "paste") {
      // A pasted intention arrives as one block: fold newlines/tabs to
      // spaces (enter must not submit mid-paste) and drop control chars.
      const text = stripTerminalControls(key.text);
      if (text.length > 0) this.textInput.insert(text);
      return;
    }

    if (key.type === "home") {
      this.textInput.moveToStart();
      return;
    }

    if (key.type === "end") {
      this.textInput.moveToEnd();
      return;
    }
  }
}
