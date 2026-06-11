/**
 * Validate a raw --seed option value. Number("abc") is NaN, and NaN|0
 * collapses the seeded PRNG state to a constant — a typo'd seed would
 * silently yield the same "random" cast forever (always KW 2). Reject
 * anything non-numeric loudly instead: stderr + exit 1.
 *
 * Shared by the cast command (commands/cast.ts) and the no-subcommand
 * entry modes in main.ts, so the TUI refuses a bad seed before it ever
 * enters the alt screen — identically to `iching cast`.
 */
export function parseSeed(rawSeed: string | undefined): number | undefined {
  if (rawSeed === undefined) return undefined;
  const seed = Number(rawSeed);
  if (rawSeed.trim() === "" || !Number.isFinite(seed)) {
    console.error(`Invalid --seed "${rawSeed}": expected a number.`);
    process.exit(1);
  }
  return seed;
}
