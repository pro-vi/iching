// IntentionScene — optional text entry before casting

import type { Scene, SceneContext, SceneSignal } from "../../scene/types.ts";
import type { CellBuffer } from "../../render/buffer.ts";
import type { KeyEvent } from "../../input/key-parser.ts";
import { TextInput } from "../../widgets/text-input.ts";
import { getTheme } from "../../color/theme.ts";
import { stringWidth } from "../../layout/measure.ts";

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

  render(frame: CellBuffer, _ctx: SceneContext): void {
    const t = getTheme();
    const cx = Math.floor(frame.width / 2);
    const cy = Math.floor(frame.height / 2) - 2;

    // Prompt
    const prompt = "問";
    const promptCol = cx - Math.floor(stringWidth(prompt) / 2);
    frame.writeText(cy, promptCol, prompt, { fg: t.primary });

    // Input field
    const fieldWidth = Math.min(frame.width - 8, 60);
    const fieldCol = cx - Math.floor(fieldWidth / 2);
    this.textInput.render(frame, cy + 2, fieldCol, fieldWidth, {
      fg: t.primary,
      bg: t.bg,
    });

    // Hint
    const hint = "enter cast · esc back";
    const hintCol = cx - Math.floor(stringWidth(hint) / 2);
    frame.writeText(cy + 4, hintCol, hint, { fg: t.tertiary, dim: true });
  }

  handleKey(key: KeyEvent, _ctx: SceneContext): SceneSignal | void {
    if (key.type === "enter") {
      const trimmed = this.textInput.value.trim();
      this.intention = trimmed || undefined;
      return { goto: "cast" };
    }

    if (key.type === "escape") {
      return "exit";
    }

    if (key.type === "ctrl" && key.char === "c") {
      return "exit";
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

    if (key.type === "char") {
      this.textInput.insert(key.char);
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
