// SceneRouter — push/pop scene navigation driven by typed scene signals.
//
// The router intrinsically handles the universal lifecycle signals (`exit`,
// `back`). Anything else is delegated to the user-supplied factory which
// inspects the typed signal and returns a Scene to push, or null/undefined to
// abandon the router (the unhandled signal causes the router to exit
// gracefully — typically because the signal is meant for an outer dispatcher
// like the home loop).

import type { Scene, SceneSignal } from "./types.ts";
import type { TerminalSession } from "../session/terminal-session.ts";
import type { Clock } from "../clock.ts";
import type { ColorSupport } from "../color/detect.ts";
import { runScene } from "./loop.ts";

export type SceneFactory = (signal: SceneSignal) => Scene | null;

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

  /** Run the router loop. Handles signals from scenes via push/pop or factory dispatch. */
  async run(
    session: TerminalSession,
    clock: Clock,
    colorSupport: ColorSupport,
    devMode = false,
  ): Promise<void> {
    while (this.stack.length > 0) {
      const scene = this.current();
      const signal = await runScene(scene, session, clock, colorSupport, devMode);

      if (!signal) break; // scene exited normally

      if (signal.type === "exit") break;

      if (signal.type === "back") {
        if (this.stack.length <= 1) break; // nothing to go back to → exit router
        this.pop();
        continue;
      }

      // Anything else is delegated to the factory.
      const next = this.factory(signal);
      if (next) {
        this.push(next);
        continue;
      }
      break; // factory didn't handle this signal — bail out so the caller can dispatch
    }
  }
}
