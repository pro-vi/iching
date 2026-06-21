// IntentionScene input handling — delete key and bracketed paste.

import { describe, test, expect } from "bun:test";
import { sceneCtx } from "../testing.ts";
import { IntentionScene } from "../scenes/intention/intention-scene.ts";
import type { SceneContext } from "../scene/types.ts";

function ctx(): SceneContext {
  return sceneCtx(80, 24, "truecolor");
}

function type(scene: IntentionScene, text: string): void {
  for (const char of text) {
    scene.handleKey({ type: "char", char }, ctx());
  }
}

describe("IntentionScene — delete key", () => {
  test("delete removes the character at the cursor", () => {
    const scene = new IntentionScene();
    type(scene, "ab");
    scene.handleKey({ type: "home" }, ctx());
    scene.handleKey({ type: "delete" }, ctx());
    scene.handleKey({ type: "enter" }, ctx());
    expect(scene.getIntention()).toBe("b");
  });

  test("delete at the end of input is a no-op (no scene cancel)", () => {
    const scene = new IntentionScene();
    type(scene, "abc");
    const signal = scene.handleKey({ type: "delete" }, ctx());
    expect(signal).toBeUndefined(); // crucially NOT { type: "home" }
    scene.handleKey({ type: "enter" }, ctx());
    expect(scene.getIntention()).toBe("abc");
  });
});

describe("IntentionScene — paste", () => {
  test("pasted text is inserted as a block", () => {
    const scene = new IntentionScene();
    scene.handleKey({ type: "paste", text: "what should I hold?" }, ctx());
    scene.handleKey({ type: "enter" }, ctx());
    expect(scene.getIntention()).toBe("what should I hold?");
  });

  test("newlines in a paste fold to spaces instead of submitting", () => {
    const scene = new IntentionScene();
    const signal = scene.handleKey({ type: "paste", text: "hi\nthere" }, ctx());
    expect(signal).toBeUndefined(); // paste must not confirm the intention
    scene.handleKey({ type: "enter" }, ctx());
    expect(scene.getIntention()).toBe("hi there");
  });

  test("tabs fold to spaces and control chars are dropped", () => {
    const scene = new IntentionScene();
    scene.handleKey({ type: "paste", text: "a\tb\x07c" }, ctx());
    scene.handleKey({ type: "enter" }, ctx());
    expect(scene.getIntention()).toBe("a bc");
  });

  test("C1 controls are dropped from paste", () => {
    const scene = new IntentionScene();
    scene.handleKey({ type: "paste", text: "ask\u0085\u009b31m" }, ctx());
    scene.handleKey({ type: "enter" }, ctx());
    expect(scene.getIntention()).toBe("ask31m");
  });

  test("paste lands at the cursor position", () => {
    const scene = new IntentionScene();
    scene.handleKey({ type: "char", char: "x" }, ctx());
    scene.handleKey({ type: "home" }, ctx());
    scene.handleKey({ type: "paste", text: "問 " }, ctx());
    scene.handleKey({ type: "enter" }, ctx());
    expect(scene.getIntention()).toBe("問 x");
  });
});

describe("IntentionScene — single-char sanitization", () => {
  test("control chars arriving as single char events are dropped, like paste", () => {
    // The parser routes ESC and 0x01–0x1a to escape/ctrl, but 0x1c–0x1f
    // (Ctrl+\/]/^/_), 0x7f and stray bytes arrive as `char` events. An intention
    // is replayed to the terminal in the journal list/preview and the reading
    // panel, so they must be stripped at entry — the char path, not just paste.
    const scene = new IntentionScene();
    scene.handleKey({ type: "char", char: "w" }, ctx());
    scene.handleKey({ type: "char", char: "\x1c" }, ctx()); // FS (Ctrl+\)
    scene.handleKey({ type: "char", char: "\x1f" }, ctx()); // US (Ctrl+_)
    scene.handleKey({ type: "char", char: "i" }, ctx());
    scene.handleKey({ type: "enter" }, ctx());
    expect(scene.getIntention()).toBe("wi"); // not "w\x1c\x1fi"
  });
});
