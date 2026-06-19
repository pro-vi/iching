import { dateInZone } from "@iching/core";

/**
 * Today's date as YYYY-MM-DD in the configured timezone. `timeZone` is the
 * user's config.timezone — "system" / undefined gives machine-local (the
 * default and prior behavior); an IANA name ("America/New_York") gives that
 * zone's calendar day, so the daily anchor is right across travel / a synced
 * data dir / a CI run on a differently-zoned machine.
 */
export function localToday(timeZone?: string): string {
  return dateInZone(new Date(), timeZone);
}
