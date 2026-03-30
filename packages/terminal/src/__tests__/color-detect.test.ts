import { describe, test, expect } from "bun:test";
import { detectColorSupport } from "../color/detect.ts";

describe("detectColorSupport", () => {
  test("NO_COLOR returns 'none'", () => {
    expect(detectColorSupport({ NO_COLOR: "1" })).toBe("none");
  });

  test("NO_COLOR='' still returns 'none' (presence is enough)", () => {
    expect(detectColorSupport({ NO_COLOR: "" })).toBe("none");
  });

  test("COLORTERM=truecolor returns 'truecolor'", () => {
    expect(detectColorSupport({ COLORTERM: "truecolor" })).toBe("truecolor");
  });

  test("COLORTERM=24bit returns 'truecolor'", () => {
    expect(detectColorSupport({ COLORTERM: "24bit" })).toBe("truecolor");
  });

  test("TERM with 256color returns '256'", () => {
    expect(detectColorSupport({ TERM: "xterm-256color" })).toBe("256");
  });

  test("TERM=screen-256color returns '256'", () => {
    expect(detectColorSupport({ TERM: "screen-256color" })).toBe("256");
  });

  test("WT_SESSION returns 'truecolor' (Windows Terminal)", () => {
    expect(
      detectColorSupport({ WT_SESSION: "some-guid", TERM: "xterm" }),
    ).toBe("truecolor");
  });

  test("empty env returns '16' (default)", () => {
    expect(detectColorSupport({})).toBe("16");
  });

  test("TERM=xterm (no 256color) returns '16'", () => {
    expect(detectColorSupport({ TERM: "xterm" })).toBe("16");
  });

  test("NO_COLOR takes precedence over COLORTERM", () => {
    expect(
      detectColorSupport({ NO_COLOR: "1", COLORTERM: "truecolor" }),
    ).toBe("none");
  });
});
