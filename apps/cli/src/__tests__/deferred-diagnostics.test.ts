// Deferred diagnostics — warnings console.error'd while the persistent alt
// screen is up (corrupt-cache quarantine notes, settings save failures) are
// repainted over within a frame and lost on exit. The buffer captures them
// and replays them to the real stderr after session.exit().
//
// The module binds the "real" console.error at import time, so the recorder
// is installed BEFORE the dynamic import — everything the buffer replays
// lands in `recorded`, never on the test runner's actual stderr.

import { describe, test, expect, beforeAll, beforeEach, afterAll } from "bun:test";

const recorded: string[] = [];
const originalConsoleError = console.error;

let deferDiagnostics: () => void;
let flushDiagnostics: () => void;

beforeAll(async () => {
  console.error = (...args: unknown[]) => {
    recorded.push(args.map(String).join(" "));
  };
  const mod = await import("../util/deferred-diagnostics.js");
  deferDiagnostics = mod.deferDiagnostics;
  flushDiagnostics = mod.flushDiagnostics;
});

beforeEach(() => {
  // Each test starts restored and with an empty buffer.
  flushDiagnostics();
  recorded.length = 0;
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe("deferred diagnostics", () => {
  test("without deferral, console.error reaches stderr immediately", () => {
    console.error("plain warning");
    expect(recorded).toEqual(["plain warning"]);
  });

  test("deferred messages are invisible until flush, then replay in order", () => {
    deferDiagnostics();
    console.error("iching: daily cache is unreadable — starting fresh.");
    console.error("iching: couldn't save settings.");
    // Nothing reaches stderr while the alt screen would be up.
    expect(recorded).toEqual([]);

    flushDiagnostics();
    expect(recorded).toEqual([
      "iching: daily cache is unreadable — starting fresh.",
      "iching: couldn't save settings.",
    ]);
  });

  test("flush restores console.error for whatever comes after (fatal path)", () => {
    deferDiagnostics();
    console.error("deferred note");
    flushDiagnostics();
    // The fatal handler flushes first, THEN prints the error — it must land
    // directly on stderr, after the replayed diagnostics.
    console.error("Error: something escaped the scene stack");
    expect(recorded).toEqual([
      "deferred note",
      "Error: something escaped the scene stack",
    ]);
  });

  test("the buffer drains on flush — no duplicate replay", () => {
    deferDiagnostics();
    console.error("once only");
    flushDiagnostics();
    flushDiagnostics();
    expect(recorded).toEqual(["once only"]);
  });

  test("Error instances keep their stack in the capture", () => {
    deferDiagnostics();
    const err = new Error("boom");
    console.error(err);
    flushDiagnostics();
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toContain("boom");
  });

  test("a flush with nothing buffered emits nothing", () => {
    deferDiagnostics();
    flushDiagnostics();
    expect(recorded).toEqual([]);
  });
});
