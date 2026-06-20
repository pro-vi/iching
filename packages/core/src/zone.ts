// zone.ts — timezone-aware projections of an instant.
//
// The daily anchor (which calendar day "now" falls in) and the 時 phase-of-day
// binning both need the LOCAL wall-clock in the user's configured zone, not the
// machine's. config.timezone is "system" (machine-local, the default) or an IANA
// name ("America/New_York"). These are pure given their `instant` argument —
// caller supplies the Date, so they stay testable without pinning a runtime zone.
// An unknown/invalid zone falls back to machine-local rather than throwing.

const pad = (n: number): string => String(n).padStart(2, "0");

/** Machine-local YYYY-MM-DD — the fallback when no IANA zone applies (the
 *  "system"/absent branch and the invalid-zone catch must format it the same). */
const localDate = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * The YYYY-MM-DD calendar date of `instant` in `timeZone` (machine-local when the
 * zone is absent or "system"). Uses formatToParts so it never depends on a
 * locale's date separator.
 */
export function dateInZone(instant: Date, timeZone?: string): string {
  if (!timeZone || timeZone === "system") {
    return localDate(instant);
  }
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(instant);
    const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? "";
    const y = get("year");
    const m = get("month");
    const d = get("day");
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // Invalid IANA name — fall through to machine-local (config validation
    // should prevent this; this is defense-in-depth, never a throw).
  }
  return localDate(instant);
}

/**
 * The local hour (0–23) of `instant` in `timeZone` (machine-local when the zone
 * is absent or "system"). The phase-of-day binning maps this through phaseOfHour.
 */
export function hourInZone(instant: Date, timeZone?: string): number {
  if (!timeZone || timeZone === "system") return instant.getHours();
  try {
    const part = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      hour12: false,
    })
      .formatToParts(instant)
      .find((p) => p.type === "hour");
    if (part) return Number(part.value) % 24; // "24" at midnight in some locales → 0
  } catch {
    // Invalid zone → machine-local.
  }
  return instant.getHours();
}
