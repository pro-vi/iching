/**
 * Format an ISO timestamp as an HH:MM clock string, or "" when it can't be
 * parsed. Shared by the CLI journal output and the TUI journal scene so a
 * reading's time renders identically in both.
 *
 * Reads the MACHINE-local hour (Date.getHours) — unlike the config.timezone-aware
 * phase binning (zone.ts `hourInZone`). Aligning the displayed clock to
 * config.timezone would be a behavior change, so it's left for a separate pass.
 */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
