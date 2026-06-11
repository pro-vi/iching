// SettingsScene quit/back consistency — q mirrors escape (save & back).
// Settings was the only scene where q did nothing; every other scene maps
// q to back/home, and Settings has no text input that needs the character.

import { describe, expect, test } from "bun:test";
import { SettingsScene } from "../scenes/settings/settings-scene.ts";
import type { SceneContext } from "../scene/types.ts";

function makeCtx(cols = 80, rows = 24): SceneContext {
  return { cols, rows, done: false, colorSupport: "none" };
}

function makeScene(): SettingsScene {
  return new SettingsScene({
    theme: "bone",
    language: "en",
    taijituStyle: "dots",
    glyphAnim: "dots",
    glyphFont: "kaiti",
    castMethod: "coin",
    castMode: "auto",
    entropy: "crypto",
  });
}

describe("SettingsScene q key", () => {
  test("q saves & backs exactly like escape", () => {
    const scene = makeScene();
    const ctx = makeCtx();
    // Change a value first so "save" is observable through getValues().
    scene.handleKey({ type: "arrow", direction: "down" }, ctx); // focus Language
    scene.handleKey({ type: "arrow", direction: "right" }, ctx); // en -> zh-Hant
    const signal = scene.handleKey({ type: "char", char: "q" }, ctx);
    expect(signal).toEqual({ type: "home" });
    expect(scene.getValues().language).toBe("zh-Hant");
  });

  test("escape still saves & backs (unchanged)", () => {
    const scene = makeScene();
    const signal = scene.handleKey({ type: "escape" }, makeCtx());
    expect(signal).toEqual({ type: "home" });
  });

  test("Ctrl+C still exits (revert path)", () => {
    const scene = makeScene();
    const signal = scene.handleKey({ type: "ctrl", char: "c" }, makeCtx());
    expect(signal).toEqual({ type: "exit" });
  });
});
