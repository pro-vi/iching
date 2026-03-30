import { describe, test, expect } from "bun:test";
import { parseKey, type KeyEvent } from "../input/key-parser.ts";

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
