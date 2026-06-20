// formatTime — the shared ISO → HH:MM clock formatter used by both the CLI
// journal output and the TUI journal scene (they must render a reading's time
// identically). Reads the machine-local hour, so the cases round-trip a LOCAL
// time through ISO and back, keeping the assertions timezone-independent.

import { describe, test, expect } from "bun:test";
import { formatTime } from "@iching/core";

describe("formatTime", () => {
  test("formats as zero-padded local HH:MM", () => {
    expect(formatTime(new Date(2026, 0, 5, 9, 7).toISOString())).toBe("09:07");
    expect(formatTime(new Date(2026, 0, 5, 14, 30).toISOString())).toBe("14:30");
    expect(formatTime(new Date(2026, 0, 5, 0, 0).toISOString())).toBe("00:00");
    expect(formatTime(new Date(2026, 0, 5, 23, 59).toISOString())).toBe("23:59");
  });

  test("an unparseable timestamp yields an empty string", () => {
    expect(formatTime("not-a-date")).toBe("");
    expect(formatTime("")).toBe("");
  });
});
