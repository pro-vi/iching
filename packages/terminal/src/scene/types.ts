// Scene interface — lifecycle contract for terminal scenes

import type { CellBuffer } from "../render/buffer.ts";
import type { KeyEvent } from "../input/key-parser.ts";
import type { ColorSupport } from "../color/detect.ts";

export interface SceneContext {
  cols: number;
  rows: number;
  done: boolean;
  colorSupport: ColorSupport;
}

export type SceneSignal = "continue" | "exit" | { goto: string };

export interface Scene {
  enter?(ctx: SceneContext): void | Promise<void>;
  update(elapsed: number, dt: number, ctx: SceneContext): void;
  render(frame: CellBuffer, ctx: SceneContext): void;
  handleKey?(key: KeyEvent, ctx: SceneContext): SceneSignal | void;
  resize?(cols: number, rows: number): void;
  exit?(ctx: SceneContext): void | Promise<void>;
}
