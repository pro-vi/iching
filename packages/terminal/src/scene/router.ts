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
import type { DisplayLanguage } from "@iching/core";
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

  /**
   * Run the router loop. Handles signals from scenes via push/pop or factory dispatch.
   * Returns `{ shouldExit: true }` when an inner scene emits `{ type: "exit" }`
   * (e.g. Ctrl+C) so the caller can terminate the program. Otherwise returns
   * `{ shouldExit: false }` for graceful router exits (back-from-bottom, factory
   * returned null, or scene completed without a signal).
   */
  async run(
    session: TerminalSession,
    clock: Clock,
    colorSupport: ColorSupport,
    devMode = false,
    language: DisplayLanguage = "en",
  ): Promise<{ shouldExit: boolean }> {
    while (this.stack.length > 0) {
      const scene = this.current();
      const signal = await runScene(scene, session, clock, colorSupport, devMode, language);

      if (!signal) return { shouldExit: false }; // scene exited normally

      if (signal.type === "exit") return { shouldExit: true };

      if (signal.type === "back") {
        if (this.stack.length <= 1) return { shouldExit: false };
        this.pop();
        continue;
      }

      // Anything else is delegated to the factory.
      const next = this.factory(signal);
      if (next) {
        // openDetail may ask to replace (detail prev/next sequence walk) so
        // esc pops straight back to the list instead of unwinding the walk.
        if (signal.type === "openDetail" && signal.replace) {
          this.replace(next);
        } else {
          this.push(next);
        }
        continue;
      }
      return { shouldExit: false }; // factory didn't handle — caller will dispatch
    }
    return { shouldExit: false };
  }
}
