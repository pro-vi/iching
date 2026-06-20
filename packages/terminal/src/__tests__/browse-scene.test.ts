import { describe, test, expect } from "bun:test";
import { sceneCtx, bufferText } from "../testing.ts";
import { BrowseScene } from "../scenes/dict/browse-scene.ts";
import { CellBuffer } from "../render/buffer.ts";
import type { KeyEvent } from "../input/key-parser.ts";

describe("BrowseScene", () => {
  test("enter sets viewport height", () => {
    const scene = new BrowseScene();
    const ctx = sceneCtx(80, 24);
    scene.enter(ctx);
    // 24 - 2 header - 2 footer = 20
    expect(scene.getModel().viewportHeight).toBe(20);
  });

  test("render draws the hexagram list into the buffer", () => {
    const scene = new BrowseScene();
    const ctx = sceneCtx();
    scene.enter(ctx);
    const buf = CellBuffer.create(80, 24);
    scene.render(buf, ctx);
    // The browse list opens on hexagram 1 (乾); a blank or broken render — which
    // the old expect(true).toBe(true) accepted — fails here.
    expect(bufferText(buf)).toContain("乾");
  });

  test("arrow down moves cursor", () => {
    const scene = new BrowseScene();
    scene.enter(sceneCtx());
    scene.handleKey({ type: "arrow", direction: "down" }, sceneCtx());
    expect(scene.getModel().cursor).toBe(1);
  });

  test("enter returns openDetail", () => {
    const scene = new BrowseScene();
    scene.enter(sceneCtx());
    const signal = scene.handleKey({ type: "enter" }, sceneCtx());
    expect(signal).toEqual({ type: "openDetail", kw: 1 });
  });

  test("enter on second hexagram returns openDetail kw=2", () => {
    const scene = new BrowseScene();
    scene.enter(sceneCtx());
    scene.handleKey({ type: "arrow", direction: "down" }, sceneCtx());
    const signal = scene.handleKey({ type: "enter" }, sceneCtx());
    expect(signal).toEqual({ type: "openDetail", kw: 2 });
  });

  test("q pops back when not in search mode", () => {
    const scene = new BrowseScene();
    const signal = scene.handleKey({ type: "char", char: "q" }, sceneCtx());
    expect(signal).toEqual({ type: "back" });
  });

  test("/ activates search mode", () => {
    const scene = new BrowseScene();
    scene.handleKey({ type: "char", char: "/" }, sceneCtx());
    expect(scene.getModel().searchActive).toBe(true);
  });

  test("typing filters results", () => {
    const scene = new BrowseScene();
    scene.enter(sceneCtx());
    // Type 'c', 'r', 'e' to search for "creative"
    for (const ch of "creative") {
      scene.handleKey({ type: "char", char: ch }, sceneCtx());
    }
    expect(scene.getModel().searchActive).toBe(true);
    expect(scene.getModel().filtered.length).toBeGreaterThan(0);
    expect(scene.getModel().filtered[0].ename).toBe("The Creative");
  });

  test("control chars typed into search are dropped, like paste", () => {
    // The parser emits 0x1c–0x1f / 0x7f / stray bytes as char events; the query
    // echoes in the search input, so they must be stripped (the char path, not
    // just paste). Matches the intention and journal-search inputs.
    const scene = new BrowseScene();
    scene.enter(sceneCtx());
    scene.handleKey({ type: "char", char: "f" }, sceneCtx());
    scene.handleKey({ type: "char", char: "\x1c" }, sceneCtx()); // FS (Ctrl+\)
    scene.handleKey({ type: "char", char: "\x1f" }, sceneCtx()); // US (Ctrl+_)
    for (const ch of "ire") scene.handleKey({ type: "char", char: ch }, sceneCtx());
    expect(scene.getModel().query).toBe("fire"); // control chars never reach the query
  });

  test("paste activates search and filters results", () => {
    const scene = new BrowseScene();
    scene.enter(sceneCtx());
    scene.handleKey({ type: "paste", text: "creative" }, sceneCtx());
    expect(scene.getModel().searchActive).toBe(true);
    expect(scene.getModel().query).toBe("creative");
    expect(scene.getModel().filtered.length).toBeGreaterThan(0);
    expect(scene.getModel().filtered[0].ename).toBe("The Creative");
  });

  test("paste folds newlines and strips control chars before filtering", () => {
    const scene = new BrowseScene();
    scene.enter(sceneCtx());
    scene.handleKey({ type: "char", char: "/" }, sceneCtx());
    scene.handleKey({ type: "paste", text: "cre\native\x07" }, sceneCtx());
    expect(scene.getModel().query).toBe("cre ative");
  });

  test("paste strips C1 controls before filtering", () => {
    const scene = new BrowseScene();
    scene.enter(sceneCtx());
    scene.handleKey({ type: "paste", text: "creative\u0085" }, sceneCtx());
    expect(scene.getModel().query).toBe("creative");
    expect(scene.getModel().filtered.length).toBeGreaterThan(0);
    expect(scene.getModel().filtered[0].ename).toBe("The Creative");
  });

  test("paste appends to an existing query at the cursor", () => {
    const scene = new BrowseScene();
    scene.enter(sceneCtx());
    scene.handleKey({ type: "char", char: "t" }, sceneCtx());
    scene.handleKey({ type: "paste", text: "ai" }, sceneCtx());
    expect(scene.getModel().query).toBe("tai");
  });

  test("an all-control-chars paste changes nothing", () => {
    const scene = new BrowseScene();
    scene.enter(sceneCtx());
    scene.handleKey({ type: "paste", text: "\x00\x07\x7f" }, sceneCtx());
    expect(scene.getModel().searchActive).toBe(false);
    expect(scene.getModel().filtered).toHaveLength(64);
  });

  test("escape clears search", () => {
    const scene = new BrowseScene();
    scene.enter(sceneCtx());
    scene.handleKey({ type: "char", char: "/" }, sceneCtx());
    scene.handleKey({ type: "char", char: "a" }, sceneCtx());
    scene.handleKey({ type: "escape" }, sceneCtx());
    expect(scene.getModel().searchActive).toBe(false);
    expect(scene.getModel().filtered).toHaveLength(64);
  });

  test("escape without search returns back", () => {
    const scene = new BrowseScene();
    const signal = scene.handleKey({ type: "escape" }, sceneCtx());
    expect(signal).toEqual({ type: "back" });
  });

  test("backspace in search removes character", () => {
    const scene = new BrowseScene();
    scene.enter(sceneCtx());
    scene.handleKey({ type: "char", char: "a" }, sceneCtx());
    scene.handleKey({ type: "char", char: "b" }, sceneCtx());
    scene.handleKey({ type: "backspace" }, sceneCtx());
    expect(scene.getModel().query).toBe("a");
  });

  test("page down moves the cursor by one viewport height (not a constant)", () => {
    // 80x24 → viewportHeight 24-2-2 = 20.
    const a = new BrowseScene();
    a.enter(sceneCtx(80, 24));
    a.handleKey({ type: "page", direction: "down" }, sceneCtx(80, 24));
    expect(a.getModel().cursor).toBe(20);

    // 80x30 → viewportHeight 26: proves the page step tracks viewportHeight, not
    // a hardcoded 20 (which the single-height assertion couldn't distinguish).
    const b = new BrowseScene();
    b.enter(sceneCtx(80, 30));
    b.handleKey({ type: "page", direction: "down" }, sceneCtx(80, 30));
    expect(b.getModel().cursor).toBe(26);
  });

  test("home goes to first", () => {
    const scene = new BrowseScene();
    scene.enter(sceneCtx());
    scene.handleKey({ type: "arrow", direction: "down" }, sceneCtx());
    scene.handleKey({ type: "arrow", direction: "down" }, sceneCtx());
    scene.handleKey({ type: "home" }, sceneCtx());
    expect(scene.getModel().cursor).toBe(0);
  });

  test("end goes to last", () => {
    const scene = new BrowseScene();
    scene.enter(sceneCtx());
    scene.handleKey({ type: "end" }, sceneCtx());
    expect(scene.getModel().cursor).toBe(63);
  });

  test("renders at 80x24 minimum", () => {
    const scene = new BrowseScene();
    const ctx = sceneCtx(80, 24);
    scene.enter(ctx);
    const buf = CellBuffer.create(80, 24);
    scene.render(buf, ctx);
    // Check header row has content
    const headerCell = buf.getCell(0, 1);
    expect(headerCell.char).not.toBe(" ");
  });
});
