// Regression tests for full CSI/SS3 sequence consumption, the delete key,
// bracketed paste, and split-UTF-8 buffering. The bug class these pin:
// unknown sequences used to leak a spurious escape (which cancels scenes)
// plus their remainder bytes as literal chars.

import { describe, test, expect } from "bun:test";
import { parseKey, KeyParser, type KeyEvent } from "../input/key-parser.ts";

function bytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function collect(): { events: KeyEvent[]; parser: KeyParser } {
  const events: KeyEvent[] = [];
  const parser = new KeyParser((e) => events.push(e));
  return { events, parser };
}

describe("parseKey — full CSI consumption", () => {
  test("Delete (ESC [ 3 ~) parses as delete, not escape + '~'", () => {
    expect(parseKey(new Uint8Array([0x1b, 0x5b, 0x33, 0x7e]))).toEqual({ type: "delete" });
  });

  test("Ctrl+Delete (ESC [ 3 ; 5 ~) parses as delete", () => {
    expect(parseKey(bytes("\x1b[3;5~"))).toEqual({ type: "delete" });
  });

  test("modified arrows map to plain arrows (Ctrl+Right ESC [ 1 ; 5 C)", () => {
    expect(parseKey(bytes("\x1b[1;5C"))).toEqual({ type: "arrow", direction: "right" });
    expect(parseKey(bytes("\x1b[1;2A"))).toEqual({ type: "arrow", direction: "up" });
  });

  test("modified Home/End (ESC [ 1 ; 5 H / F)", () => {
    expect(parseKey(bytes("\x1b[1;5H"))).toEqual({ type: "home" });
    expect(parseKey(bytes("\x1b[1;5F"))).toEqual({ type: "end" });
  });

  test("F5 (ESC [ 1 5 ~) is swallowed — no escape", () => {
    expect(parseKey(bytes("\x1b[15~"))).toBeNull();
  });

  test("Insert (ESC [ 2 ~) is swallowed", () => {
    expect(parseKey(bytes("\x1b[2~"))).toBeNull();
  });

  test("Shift+Tab (ESC [ Z) is swallowed", () => {
    expect(parseKey(bytes("\x1b[Z"))).toBeNull();
  });

  test("SS3 F1 (ESC O P) is swallowed", () => {
    expect(parseKey(bytes("\x1bOP"))).toBeNull();
  });

  test("SS3 application-mode arrows still navigate", () => {
    expect(parseKey(bytes("\x1bOA"))).toEqual({ type: "arrow", direction: "up" });
    expect(parseKey(bytes("\x1bOD"))).toEqual({ type: "arrow", direction: "left" });
    expect(parseKey(bytes("\x1bOH"))).toEqual({ type: "home" });
  });
});

describe("KeyParser — unknown sequences never eject the user", () => {
  test("Delete key emits exactly one delete event", () => {
    const { events, parser } = collect();
    parser.feed(new Uint8Array([0x1b, 0x5b, 0x33, 0x7e]));
    expect(events).toEqual([{ type: "delete" }]);
    parser.dispose();
  });

  test("Ctrl+Right emits no escape and no leaked chars", () => {
    const { events, parser } = collect();
    parser.feed(bytes("\x1b[1;5C"));
    expect(events).toEqual([{ type: "arrow", direction: "right" }]);
    parser.dispose();
  });

  test("F1 (SS3) emits nothing", () => {
    const { events, parser } = collect();
    parser.feed(bytes("\x1bOP"));
    expect(events).toEqual([]);
    parser.dispose();
  });

  test("F12 (ESC [ 2 4 ~) followed by typed text only emits the text", () => {
    const { events, parser } = collect();
    parser.feed(bytes("\x1b[24~hi"));
    expect(events).toEqual([
      { type: "char", char: "h" },
      { type: "char", char: "i" },
    ]);
    parser.dispose();
  });

  test("CSI split across feeds still resolves to a single event", () => {
    const { events, parser } = collect();
    parser.feed(bytes("\x1b[1;5"));
    expect(events).toEqual([]); // incomplete — buffered
    parser.feed(bytes("C"));
    expect(events).toEqual([{ type: "arrow", direction: "right" }]);
    parser.dispose();
  });

  test("lone ESC still flushes as escape after the timeout", async () => {
    const { events, parser } = collect();
    parser.feed(new Uint8Array([0x1b]));
    expect(events).toEqual([]);
    await new Promise((r) => setTimeout(r, 70));
    expect(events).toEqual([{ type: "escape" }]);
    parser.dispose();
  });
});

describe("KeyParser — bracketed paste", () => {
  test("paste block becomes a single paste event", () => {
    const { events, parser } = collect();
    parser.feed(bytes("\x1b[200~hello\x1b[201~"));
    expect(events).toEqual([{ type: "paste", text: "hello" }]);
    parser.dispose();
  });

  test("newlines inside a paste do not become enter events", () => {
    const { events, parser } = collect();
    parser.feed(bytes("\x1b[200~hi\rthere\x1b[201~"));
    expect(events).toEqual([{ type: "paste", text: "hi\nthere" }]);
    parser.dispose();
  });

  test("CRLF is normalized to a single newline", () => {
    const { events, parser } = collect();
    parser.feed(bytes("\x1b[200~a\r\nb\x1b[201~"));
    expect(events).toEqual([{ type: "paste", text: "a\nb" }]);
    parser.dispose();
  });

  test("paste content split across feeds is accumulated", () => {
    const { events, parser } = collect();
    parser.feed(bytes("\x1b[200~one "));
    parser.feed(bytes("two "));
    parser.feed(bytes("three\x1b[201~"));
    expect(events).toEqual([{ type: "paste", text: "one two three" }]);
    parser.dispose();
  });

  test("paste markers split mid-sequence still resolve", () => {
    const { events, parser } = collect();
    parser.feed(bytes("\x1b[20")); // half a start marker — buffered as incomplete CSI
    parser.feed(bytes("0~cjk 世界\x1b[2"));
    parser.feed(bytes("01~"));
    expect(events).toEqual([{ type: "paste", text: "cjk 世界" }]);
    parser.dispose();
  });

  test("keys after the paste block parse normally", () => {
    const { events, parser } = collect();
    parser.feed(bytes("\x1b[200~x\x1b[201~\rq"));
    expect(events).toEqual([
      { type: "paste", text: "x" },
      { type: "enter" },
      { type: "char", char: "q" },
    ]);
    parser.dispose();
  });

  test("stray paste-end marker without a start is swallowed", () => {
    const { events, parser } = collect();
    parser.feed(bytes("\x1b[201~a"));
    expect(events).toEqual([{ type: "char", char: "a" }]);
    parser.dispose();
  });
});

describe("KeyParser — paste accumulation stays bounded", () => {
  test("a paste whose terminator never comes is delivered at the cap", () => {
    const { events, parser } = collect();
    parser.feed(bytes("\x1b[200~"));
    const chunk = "x".repeat(16 * 1024);
    for (let i = 0; i < 5; i++) parser.feed(bytes(chunk)); // 80 KiB, no end marker
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("paste");
    expect(events[0]).toEqual({ type: "paste", text: chunk.repeat(5) });

    // Normal parsing resumed — keys arrive as keys again…
    parser.feed(bytes("q"));
    expect(events[1]).toEqual({ type: "char", char: "q" });
    // …and a late terminator is swallowed silently, not leaked as escape.
    parser.feed(bytes("\x1b[201~"));
    expect(events).toHaveLength(2);
    parser.dispose();
  });

  test("a complete paste past the cap in one feed still delivers intact", () => {
    const { events, parser } = collect();
    const text = "y".repeat(100 * 1024);
    parser.feed(bytes(`\x1b[200~${text}\x1b[201~`));
    expect(events).toEqual([{ type: "paste", text }]);
    parser.dispose();
  });

  test("an unterminated paste flushes after a quiet gap", async () => {
    const { events, parser } = collect();
    parser.feed(bytes("\x1b[200~adrift"));
    expect(events).toEqual([]);
    await new Promise((r) => setTimeout(r, 600));
    expect(events).toEqual([{ type: "paste", text: "adrift" }]);

    // The parser left paste mode — back to ordinary keys.
    parser.feed(bytes("k"));
    expect(events[1]).toEqual({ type: "char", char: "k" });
    parser.dispose();
  });

  test("a dangling paste start with no content goes quietly (no empty paste)", async () => {
    const { events, parser } = collect();
    parser.feed(bytes("\x1b[200~"));
    await new Promise((r) => setTimeout(r, 600));
    expect(events).toEqual([]);
    parser.feed(bytes("k"));
    expect(events).toEqual([{ type: "char", char: "k" }]);
    parser.dispose();
  });
});

describe("KeyParser — split UTF-8 buffering", () => {
  test("3-byte CJK char split across two feeds decodes intact", () => {
    const { events, parser } = collect();
    const cjk = bytes("世"); // e4 b8 96
    parser.feed(cjk.subarray(0, 1));
    expect(events).toEqual([]);
    parser.feed(cjk.subarray(1));
    expect(events).toEqual([{ type: "char", char: "世" }]);
    parser.dispose();
  });

  test("4-byte char split 2+2 decodes intact", () => {
    const { events, parser } = collect();
    const glyph = bytes("𠀀"); // U+20000, 4 bytes
    parser.feed(glyph.subarray(0, 2));
    expect(events).toEqual([]);
    parser.feed(glyph.subarray(2));
    expect(events).toEqual([{ type: "char", char: "𠀀" }]);
    parser.dispose();
  });

  test("split char followed by ascii in the same chunk", () => {
    const { events, parser } = collect();
    const cjk = bytes("問");
    parser.feed(cjk.subarray(0, 2));
    parser.feed(new Uint8Array([...cjk.subarray(2), 0x61])); // rest + 'a'
    expect(events).toEqual([
      { type: "char", char: "問" },
      { type: "char", char: "a" },
    ]);
    parser.dispose();
  });
});
