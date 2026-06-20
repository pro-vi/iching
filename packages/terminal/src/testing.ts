// Test support for terminal scenes. Imported relatively by the package's own
// __tests__ (the cross-package analogue is @iching/core/testing); not part of the
// public surface.

import type { DisplayLanguage } from "@iching/core";
import type { ColorSupport } from "./color/detect.ts";
import type { SceneContext } from "./scene/types.ts";

/**
 * A SceneContext for tests. Nine scene suites each hand-rolled this same shape
 * ({ cols, rows, done: false, colorSupport, [language] }); centralizing it means a
 * SceneContext field addition lands in one place, not nine. `language` is omitted
 * (not set to undefined) unless given, matching the optional field.
 */
export function sceneCtx(
  cols = 80,
  rows = 24,
  colorSupport: ColorSupport = "none",
  language?: DisplayLanguage,
): SceneContext {
  return language === undefined
    ? { cols, rows, done: false, colorSupport }
    : { cols, rows, done: false, colorSupport, language };
}
