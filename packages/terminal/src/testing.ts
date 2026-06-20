// Test support for terminal scenes. Imported relatively by the package's own
// __tests__ (the cross-package analogue is @iching/core/testing); not part of the
// public surface.

import type { Cast, DisplayLanguage } from "@iching/core";
import type { ColorSupport } from "./color/detect.ts";
import type { SceneContext } from "./scene/types.ts";
import type { CellBuffer } from "./render/buffer.ts";
import type { SettingsValues } from "./scenes/settings/settings-scene.ts";

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

/**
 * Hexagram 21 with lines 1 and 4 changing (→ 42). Three render suites shared this
 * exact fixed cast: the line values, becoming, and four derivations are hardcoded
 * (not computed via castOf) so rendered output stays deterministic across runs.
 */
export function changingCast(): Cast {
  return {
    lines: [
      { value: 9, isYang: true, isChanging: true }, // line 1: old yang -> yin
      { value: 8, isYang: false, isChanging: false }, // line 2: young yin
      { value: 7, isYang: true, isChanging: false }, // line 3: young yang
      { value: 6, isYang: false, isChanging: true }, // line 4: old yin -> yang
      { value: 7, isYang: true, isChanging: false }, // line 5: young yang
      { value: 8, isYang: false, isChanging: false }, // line 6: young yin
    ],
    primary: 21,
    becoming: 42,
    changingPositions: [1, 4],
    nuclear: 39,
    polarity: 48,
    mirror: 22,
    diagonal: 47,
  };
}

/**
 * A SettingsValues for tests. The settings suites repeated this 8-field default
 * (theme "bone", glyphs dots/kaiti, coin/auto/crypto) and varied one or two
 * fields per case; pass those as `overrides` so a new SettingsValues field lands
 * here once, not in every settings test.
 */
export function settingsValues(overrides: Partial<SettingsValues> = {}): SettingsValues {
  return {
    theme: "bone",
    language: "en",
    taijituStyle: "dots",
    glyphAnim: "dots",
    glyphFont: "kaiti",
    castMethod: "coin",
    castMode: "auto",
    entropy: "crypto",
    ...overrides,
  };
}
