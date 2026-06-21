// zone.ts — timezone-aware date/hour projections. Pure given the instant, so a
// fixed UTC instant + explicit IANA zones make these deterministic regardless of
// the runner's own timezone.

import { describe, test, expect } from "bun:test";
import { dateInZone, hourInZone } from "../zone.ts";

const INSTANT = new Date("2026-01-01T04:00:00.000Z"); // 04:00 UTC

describe("dateInZone", () => {
  test("undefined and 'system' agree (machine-local, whatever the runner's zone)", () => {
    expect(dateInZone(INSTANT)).toBe(dateInZone(INSTANT, "system"));
  });

  test("UTC", () => {
    expect(dateInZone(INSTANT, "UTC")).toBe("2026-01-01");
  });

  test("a zone west of UTC can roll back to the previous calendar day", () => {
    // 04:00 UTC is 23:00 the PREVIOUS day in New York (UTC−5 in January) — the
    // exact mis-dating the machine-local anchor caused for a traveling user.
    expect(dateInZone(INSTANT, "America/New_York")).toBe("2025-12-31");
  });

  test("a zone east of UTC", () => {
    expect(dateInZone(INSTANT, "Asia/Shanghai")).toBe("2026-01-01"); // 12:00 same day
  });

  test("an invalid IANA name falls back to machine-local, never throws", () => {
    expect(dateInZone(INSTANT, "Not/AZone")).toBe(dateInZone(INSTANT, "system"));
  });
});

describe("hourInZone", () => {
  test("UTC / west / east", () => {
    expect(hourInZone(INSTANT, "UTC")).toBe(4);
    expect(hourInZone(INSTANT, "America/New_York")).toBe(23);
    expect(hourInZone(INSTANT, "Asia/Shanghai")).toBe(12);
  });

  test("midnight normalizes 24 → 0", () => {
    // 16:00 UTC is 00:00 the next day in Shanghai (UTC+8); hour12:false can yield "24".
    expect(hourInZone(new Date("2026-01-01T16:00:00.000Z"), "Asia/Shanghai")).toBe(0);
  });

  test("undefined / 'system' / invalid all fall back to machine-local", () => {
    expect(hourInZone(INSTANT)).toBe(INSTANT.getHours());
    expect(hourInZone(INSTANT, "system")).toBe(INSTANT.getHours());
    expect(hourInZone(INSTANT, "Not/AZone")).toBe(INSTANT.getHours());
  });
});
