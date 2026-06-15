import { describe, test, expect } from "bun:test";
import { parseKey, parseKeyWithLength, KeyParser, type KeyEvent } from "../input/key-parser.ts";

/** ASCII string → byte buffer (each char one byte). */
const bytes = (s: string): Uint8Array => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

describe("parseKey", () => {
  test("parse arrow up", () => {
    const event = parseKey(new Uint8Array([0x1b, 0x5b, 0x41]));
    expect(event).toEqual({ type: "arrow", direction: "up" });
  });

  test("parse arrow down", () => {
    const event = parseKey(new Uint8Array([0x1b, 0x5b, 0x42]));
    expect(event).toEqual({ type: "arrow", direction: "down" });
  });

  test("parse arrow right", () => {
    const event = parseKey(new Uint8Array([0x1b, 0x5b, 0x43]));
    expect(event).toEqual({ type: "arrow", direction: "right" });
  });

  test("parse arrow left", () => {
    const event = parseKey(new Uint8Array([0x1b, 0x5b, 0x44]));
    expect(event).toEqual({ type: "arrow", direction: "left" });
  });

  test("parse Enter (CR)", () => {
    const event = parseKey(new Uint8Array([0x0d]));
    expect(event).toEqual({ type: "enter" });
  });

  test("parse Enter (LF)", () => {
    const event = parseKey(new Uint8Array([0x0a]));
    expect(event).toEqual({ type: "enter" });
  });

  test("parse Escape (standalone)", () => {
    const event = parseKey(new Uint8Array([0x1b]));
    expect(event).toEqual({ type: "escape" });
  });

  test("parse Ctrl-C", () => {
    const event = parseKey(new Uint8Array([0x03]));
    expect(event).toEqual({ type: "ctrl", char: "c" });
  });

  test("parse Ctrl-D", () => {
    const event = parseKey(new Uint8Array([0x04]));
    expect(event).toEqual({ type: "ctrl", char: "d" });
  });

  test("parse Ctrl-A", () => {
    const event = parseKey(new Uint8Array([0x01]));
    expect(event).toEqual({ type: "ctrl", char: "a" });
  });

  test("parse regular character 'a'", () => {
    const event = parseKey(new Uint8Array([0x61]));
    expect(event).toEqual({ type: "char", char: "a" });
  });

  test("parse regular character 'Z'", () => {
    const event = parseKey(new Uint8Array([0x5a]));
    expect(event).toEqual({ type: "char", char: "Z" });
  });

  test("parse space", () => {
    const event = parseKey(new Uint8Array([0x20]));
    expect(event).toEqual({ type: "char", char: " " });
  });

  test("handle empty buffer", () => {
    const event = parseKey(new Uint8Array([]));
    expect(event).toBeNull();
  });

  test("handle incomplete escape sequence (ESC + [)", () => {
    // ESC + [ without third byte
    const event = parseKey(new Uint8Array([0x1b, 0x5b]));
    // Should return escape since it's an unrecognized/incomplete CSI
    expect(event).toEqual({ type: "escape" });
  });

  test("parse multi-byte UTF-8 character", () => {
    // "é" is 0xC3 0xA9 in UTF-8
    const event = parseKey(new Uint8Array([0xc3, 0xa9]));
    expect(event).toEqual({ type: "char", char: "\u00e9" });
  });
});

describe("mouse wheel \u2192 scroll arrow; clicks and coordinate bytes swallowed", () => {
  // SGR mouse (DEC 1006): ESC [ < Cb ; Cx ; Cy M(press)/m(release)
  test("SGR wheel up \u2192 arrow up", () => {
    expect(parseKey(bytes("\x1b[<64;10;5M"))).toEqual({ type: "arrow", direction: "up" });
  });
  test("SGR wheel down \u2192 arrow down", () => {
    expect(parseKey(bytes("\x1b[<65;10;5M"))).toEqual({ type: "arrow", direction: "down" });
  });
  test("SGR click is swallowed (no event, no \u2190/\u2192)", () => {
    expect(parseKey(bytes("\x1b[<0;10;5M"))).toBeNull();
  });
  test("SGR horizontal wheel is ignored \u2014 never \u2190/\u2192", () => {
    expect(parseKey(bytes("\x1b[<66;10;5M"))).toBeNull();
    expect(parseKey(bytes("\x1b[<67;10;5M"))).toBeNull();
  });
  test("SGR release (m) is swallowed", () => {
    expect(parseKey(bytes("\x1b[<0;10;5m"))).toBeNull();
  });

  // X10 mouse: ESC [ M Cb Cx Cy, each value carried as byte + 32 (raw bytes)
  test("X10 wheel down \u2192 arrow down, consuming all 6 bytes", () => {
    const r = parseKeyWithLength(new Uint8Array([0x1b, 0x5b, 0x4d, 65 + 32, 0x21, 0x21]));
    expect(r).toEqual({ event: { type: "arrow", direction: "down" }, consumed: 6 });
  });

  test("X10 coordinate bytes never leak as keys (the scroll-navigates bug)", () => {
    // A click report whose column byte is 'l' (0x6c). Pre-fix the parser consumed
    // only ESC[M and re-read the coords as chars \u2014 leaking 'l', which the detail
    // view reads as next-gua. All 6 bytes must be consumed, with no event.
    const events: KeyEvent[] = [];
    const parser = new KeyParser((e) => events.push(e));
    parser.feed(new Uint8Array([0x1b, 0x5b, 0x4d, 0x20, 0x6c, 0x21])); // \e[M, btn 0, col 'l'
    expect(events).toEqual([]);
  });

  test("a split X10 report buffers until all 6 bytes arrive", () => {
    const events: KeyEvent[] = [];
    const parser = new KeyParser((e) => events.push(e));
    parser.feed(new Uint8Array([0x1b, 0x5b, 0x4d, 65 + 32])); // partial \u2014 wait
    expect(events).toEqual([]);
    parser.feed(new Uint8Array([0x21, 0x21])); // rest \u2192 wheel down
    expect(events).toEqual([{ type: "arrow", direction: "down" }]);
  });
});
