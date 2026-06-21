/**
 * Print a message to stderr and exit non-zero — the CLI's fatal-error convention.
 * Returns `never`, so a caller needs no redundant return after it. Pair with
 * formatError for caught exceptions: `die(formatError(err))`.
 */
export function die(message: string): never {
  console.error(message);
  process.exit(1);
}
