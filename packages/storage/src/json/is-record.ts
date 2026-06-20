/**
 * True for a plain non-null, non-array object — the shape every JSON record
 * parser checks before reading fields off untrusted input. A type guard, so a
 * passing value narrows to Record<string, unknown> and the caller needs no cast.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
