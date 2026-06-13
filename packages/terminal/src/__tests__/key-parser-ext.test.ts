import { describe, test, expect } from "bun:test";
import { parseKey, KeyParser, type KeyEvent } from "../input/key-parser.ts";

describe("parseKey — extended keys", () => {
  test("parse Tab", () => {
    const event = parseKey(new Uint8Array([0x09]));
    expect(event).toEqual({ type: "tab" });
  });

  test("parse Backspace (DEL 0x7F)", () => {
    const event = parseKey(new Uint8Array([0x7f]));
    expect(event).toEqual({ type: "backspace" });
  });

  test("parse PageUp (ESC [ 5 ~)", () => {
    const event = parseKey(new Uint8Array([0x1b, 0x5b, 0x35, 0x7e]));
    expect(event).toEqual({ type: "page", direction: "up" });
  });

  test("parse PageDown (ESC [ 6 ~)", () => {
    const event = parseKey(new Uint8Array([0x1b, 0x5b, 0x36, 0x7e]));
    expect(event).toEqual({ type: "page", direction: "down" });
  });

  test("parse Home (ESC [ H)", () => {
    const event = parseKey(new Uint8Array([0x1b, 0x5b, 0x48]));
    expect(event).toEqual({ type: "home" });
  });

  test("parse End (ESC [ F)", () => {
    const event = parseKey(new Uint8Array([0x1b, 0x5b, 0x46]));
    expect(event).toEqual({ type: "end" });
  });

  test("parse Home alternate (ESC [ 1 ~)", () => {
    const event = parseKey(new Uint8Array([0x1b, 0x5b, 0x31, 0x7e]));
    expect(event).toEqual({ type: "home" });
  });

  test("parse End alternate (ESC [ 4 ~)", () => {
    const event = parseKey(new Uint8Array([0x1b, 0x5b, 0x34, 0x7e]));
    expect(event).toEqual({ type: "end" });
  });
});

describe("KeyParser — extended key buffering", () => {
  test("PageUp delivered through KeyParser feed", () => {
    const events: KeyEvent[] = [];
    const parser = new KeyParser((e) => events.push(e));

    // Feed ESC [ 5 ~ as a single chunk
    parser.feed(new Uint8Array([0x1b, 0x5b, 0x35, 0x7e]));
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "page", direction: "up" });

    parser.dispose();
  });

  test("Tab delivered through KeyParser feed", () => {
    const events: KeyEvent[] = [];
    const parser = new KeyParser((e) => events.push(e));

    parser.feed(new Uint8Array([0x09]));
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "tab" });

    parser.dispose();
  });

  test("a never-terminating escape sequence is flushed, not buffered without bound", () => {
    const events: KeyEvent[] = [];
    const parser = new KeyParser((e) => events.push(e));

    // ESC [ followed by far more param bytes than any real CSI, with no final
    // byte — it stays "incomplete" forever. Without a cap the parser buffers it
    // (and every following chunk), since the flush timer is cleared on each
    // feed; this is the unbounded-accumulation DoS the paste path already caps.
    const garbage = new Uint8Array([0x1b, 0x5b, ...new Array(2000).fill(0x30)]); // ESC[000…
    parser.feed(garbage);
    // It flushed (escape) synchronously rather than swallowing it into a buffer.
    expect(events.some((e) => e.type === "escape")).toBe(true);

    // And it recovered to a clean state — a normal keystroke now parses.
    events.length = 0;
    parser.feed(new Uint8Array([0x61])); // 'a'
    expect(events).toEqual([{ type: "char", char: "a" }]);

    parser.dispose();
  });

  test("Backspace delivered through KeyParser feed", () => {
    const events: KeyEvent[] = [];
    const parser = new KeyParser((e) => events.push(e));

    parser.feed(new Uint8Array([0x7f]));
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "backspace" });

    parser.dispose();
  });

  test("existing arrow keys still work", () => {
    const events: KeyEvent[] = [];
    const parser = new KeyParser((e) => events.push(e));

    parser.feed(new Uint8Array([0x1b, 0x5b, 0x41]));
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "arrow", direction: "up" });

    parser.dispose();
  });
});
