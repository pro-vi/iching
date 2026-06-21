/**
 * Render a caught (unknown) error for the user: an Error's stack when present
 * (else its message), or String() for a non-Error throw. The CLI's top-level and
 * command catch-blocks all display errors this way.
 */
export function formatError(err: unknown): string {
  return err instanceof Error ? (err.stack ?? err.message) : String(err);
}
