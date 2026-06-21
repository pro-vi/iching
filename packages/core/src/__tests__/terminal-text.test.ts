// stripTerminalControls — terminal-safe one-line text normalization.
// Control characters are built with fromCharCode so no raw control bytes live in
// this source file.

import { describe, test, expect } from "bun:test";
import { stripTerminalControls } from "../terminal-text.js";

const ESC = String.fromCharCode(0x1b);
const BEL = String.fromCharCode(0x07);
const DEL = String.fromCharCode(0x7f);
const CSI_C1 = String.fromCharCode(0x9b);
const ST_C1 = String.fromCharCode(0x9c);

describe("stripTerminalControls", () => {
  test("plain text, CJK, and punctuation pass through untouched", () => {
    const text = "it resolved itself - 觀, the noble one (KW20).";
    expect(stripTerminalControls(text)).toBe(text);
  });

  test("strips ESC so CSI color/clear sequences cannot replay", () => {
    expect(stripTerminalControls(`${ESC}[31mred${ESC}[0m`)).toBe("[31mred[0m");
    expect(stripTerminalControls(`${ESC}[2J${ESC}[Hwiped`)).toBe("[2J[Hwiped");
  });

  test("strips ESC and BEL so an OSC window-retitle cannot replay", () => {
    expect(stripTerminalControls(`${ESC}]0;pwned${BEL}quiet note`)).toBe(
      "]0;pwnedquiet note",
    );
  });

  test("strips single-byte C1 controls and DEL", () => {
    expect(stripTerminalControls(`${CSI_C1}31mtext${ST_C1}`)).toBe("31mtext");
    expect(stripTerminalControls(`a${DEL}b`)).toBe("ab");
  });

  test("folds tab/newline/CR runs to one space", () => {
    expect(stripTerminalControls("morning\tcast\r\nnight note")).toBe(
      "morning cast night note",
    );
  });

  test("idempotent: sanitizing sanitized text is a no-op", () => {
    const once = stripTerminalControls(`${ESC}]0;x${BEL}a\tb`);
    expect(stripTerminalControls(once)).toBe(once);
  });
});
