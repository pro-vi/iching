// Test support for terminal scenes. Imported relatively by the package's own
// __tests__ (the cross-package analogue is @iching/core/testing); not part of the
// public surface.

import type { DisplayLanguage } from "@iching/core";
import type { ColorSupport } from "./color/detect.ts";
import type { SceneContext } from "./scene/types.ts";
import type { CellBuffer } from "./render/buffer.ts";

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

/**
 * Flatten a rendered CellBuffer to text — one line per row, each row its cells'
 * chars joined. The shape four scene suites used for snapshot-style assertions on
 * what a scene drew.
 */
export function bufferText(buf: CellBuffer): string {
  return Array.from({ length: buf.height }, (_, row) =>
    buf.getRow(row).map((cell) => cell.char).join(""),
  ).join("\n");
}
