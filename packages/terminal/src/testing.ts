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
/** A single rendered row as a string — its cells' chars joined. */
export function rowText(buf: CellBuffer, row: number): string {
  return buf.getRow(row).map((cell) => cell.char).join("");
}

export function bufferText(buf: CellBuffer): string {
  return Array.from({ length: buf.height }, (_, row) => rowText(buf, row)).join("\n");
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
 * A static (no changing lines) cast of hexagram 63 (既濟, After Completion) with
 * fixed derivations; spread `overrides` to vary fields. Two cast suites shared it.
 * Like changingCast, the values are fixed (not derived via castOf) for
 * deterministic render/timeline output.
 */
export function staticCast(overrides?: Partial<Cast>): Cast {
  return {
    lines: [
      { value: 7, isYang: true, isChanging: false },
      { value: 8, isYang: false, isChanging: false },
      { value: 7, isYang: true, isChanging: false },
      { value: 8, isYang: false, isChanging: false },
      { value: 7, isYang: true, isChanging: false },
      { value: 8, isYang: false, isChanging: false },
    ],
    primary: 63,
    becoming: null,
    changingPositions: [],
    nuclear: 64,
    polarity: 64,
    mirror: 64,
    diagonal: 63,
    ...overrides,
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

/**
 * A minimal process.stdin stand-in for loop/session tests: never a TTY, raw-mode
 * and resume/pause are no-ops, and on/off track handlers in a local map. Four
 * loop/session suites shared this verbatim. The internal cast keeps callers
 * cast-free (it returns a typed process.stdin).
 */
export function mockStdin(): typeof process.stdin {
  const handlers: Record<string, Function[]> = {};
  return {
    isTTY: false,
    resume() {},
    pause() {},
    setRawMode(_mode: boolean) {},
    on(event: string, handler: Function) {
      (handlers[event] ??= []).push(handler);
    },
    off(event: string, handler: Function) {
      const list = handlers[event];
      if (list) {
        const idx = list.indexOf(handler);
        if (idx >= 0) list.splice(idx, 1);
      }
    },
  } as unknown as typeof process.stdin;
}

/**
 * A minimal process.stdout stand-in: write() records into `writes` (so loop/
 * session suites can assert on emitted ANSI) and returns true; columns/rows
 * default to 80×24. TerminalSession's structural { write, columns, rows } param
 * accepts it directly, and the recorded `writes` is harmless for suites that
 * ignore it — so this one capturing factory replaces four near-copies (two that
 * captured, two that didn't) with no call-site cast.
 */
export function mockStdout(columns = 80, rows = 24) {
  const writes: string[] = [];
  return {
    write(data: string) {
      writes.push(data);
      return true;
    },
    columns,
    rows,
    writes,
  };
}
