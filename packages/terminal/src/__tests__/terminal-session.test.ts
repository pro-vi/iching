// TerminalSession lifecycle — idempotent enter/exit, ownership-friendly
// isActive, mid-session clear, and bracketed paste mode toggling.

import { describe, test, expect } from "bun:test";
import { mockStdin } from "../testing.ts";
import { TerminalSession } from "../session/terminal-session.ts";

function mockStdout() {
  const writes: string[] = [];
  return {
    write(data: string) {
      writes.push(data);
      return true;
    },
    columns: 80,
    rows: 24,
    writes,
  };
}

describe("TerminalSession", () => {
  test("enter is idempotent — alt screen entered exactly once", () => {
    const stdout = mockStdout();
    const session = new TerminalSession(stdout, mockStdin());
    session.enter();
    session.enter();
    const altOns = stdout.writes.join("").split("\x1b[?1049h").length - 1;
    expect(altOns).toBe(1);
    session.exit();
  });

  test("isActive reflects the session state", () => {
    const session = new TerminalSession(mockStdout(), mockStdin());
    expect(session.isActive).toBe(false);
    session.enter();
    expect(session.isActive).toBe(true);
    session.exit();
    expect(session.isActive).toBe(false);
  });

  test("enter enables bracketed paste; exit disables it before leaving the alt screen", () => {
    const stdout = mockStdout();
    const session = new TerminalSession(stdout, mockStdin());
    session.enter();
    expect(stdout.writes.join("")).toContain("\x1b[?2004h");
    session.exit();
    const out = stdout.writes.join("");
    expect(out).toContain("\x1b[?2004l");
    // Paste mode is turned off before the alt screen is left
    expect(out.indexOf("\x1b[?2004l")).toBeLessThan(out.indexOf("\x1b[?1049l"));
  });

  test("disables autowrap on enter and restores it on exit", () => {
    // The renderer addresses every cell absolutely; autowrap must be OFF so an
    // over-wide row clips instead of spilling its trailing (background) cell onto
    // the next line. Restored on exit since normal-screen default is on.
    const stdout = mockStdout();
    const session = new TerminalSession(stdout, mockStdin());
    session.enter();
    expect(stdout.writes.join("")).toContain("\x1b[?7l"); // autowrap off
    session.exit();
    expect(stdout.writes.join("")).toContain("\x1b[?7h"); // autowrap restored
  });

  test("clear writes clear-screen + cursor-home while active", () => {
    const stdout = mockStdout();
    const session = new TerminalSession(stdout, mockStdin());
    session.enter();
    const before = stdout.writes.length;
    session.clear();
    expect(stdout.writes.length).toBe(before + 1);
    expect(stdout.writes[before]).toContain("\x1b[2J");
    session.exit();
  });

  test("clear is a no-op when the session is not active", () => {
    const stdout = mockStdout();
    const session = new TerminalSession(stdout, mockStdin());
    session.clear();
    expect(stdout.writes).toHaveLength(0);
  });

  test("exit is idempotent — restore sequence written exactly once", () => {
    const stdout = mockStdout();
    const session = new TerminalSession(stdout, mockStdin());
    session.enter();
    session.exit();
    session.exit();
    const altOffs = stdout.writes.join("").split("\x1b[?1049l").length - 1;
    expect(altOffs).toBe(1);
  });
});
