// SceneRouter — push/pop scene navigation with goto signal handling

import type { Scene, SceneSignal } from "./types.ts";
import type { TerminalSession } from "../session/terminal-session.ts";
import type { Clock } from "../clock.ts";
import type { ColorSupport } from "../color/detect.ts";
import { runScene } from "./loop.ts";

export type SceneFactory = (id: string) => Scene;

export class SceneRouter {
  private stack: Scene[];
  private factory: SceneFactory;

  constructor(initial: Scene, factory: SceneFactory) {
    this.stack = [initial];
    this.factory = factory;
  }

  /** Push a new scene onto the stack */
  push(scene: Scene): void {
    this.stack.push(scene);
  }

  /** Pop the current scene, returning it */
  pop(): Scene | undefined {
    if (this.stack.length > 1) {
      return this.stack.pop();
    }
    return undefined;
  }

  /** Replace the current scene */
  replace(scene: Scene): void {
    if (this.stack.length > 0) {
      this.stack[this.stack.length - 1] = scene;
    } else {
      this.stack.push(scene);
    }
  }

  /** Get the current (topmost) scene */
  current(): Scene {
    return this.stack[this.stack.length - 1];
  }

  /** Run the router loop — handles goto signals from scenes */
  async run(
    session: TerminalSession,
    clock: Clock,
    colorSupport: ColorSupport,
    devMode = false,
  ): Promise<void> {
    while (this.stack.length > 0) {
      const scene = this.current();
      const signal = await runScene(scene, session, clock, colorSupport, devMode);

      if (signal === "exit") {
        break;
      }

      if (typeof signal === "object" && signal !== null && "goto" in signal) {
        const target = signal.goto;

        if (target === "back") {
          if (this.stack.length <= 1) {
            break; // Nothing to go back to — exit
          }
          this.pop();
          continue;
        }

        if (target === "exit") {
          break;
        }

        // Push a new scene via factory (e.g. "detail:42")
        const newScene = this.factory(target);
        this.push(newScene);
        continue;
      }

      // "continue" or void — scene exited normally, exit router
      break;
    }
  }
}
