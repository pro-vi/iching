/**
 * Authoritative key sets for each persisted schema.
 *
 * Rule: schemas only expand. Adding a key requires editing this file (visible
 * in PR review). Renaming or removing a key fails the shape tests, forcing a
 * deliberate migration path before publish.
 */

type Shape = {
  readonly required: readonly string[];
  readonly optional: readonly string[];
};

export const SCHEMA_KEYS = {
  config: {
    required: [
      "motion",
      "language",
      "theme",
      "color",
      "timezone",
      "glyphAnim",
      "glyphFont",
      "taijituStyle",
      "castMethod",
      "castMode",
      "entropy",
    ],
    optional: [],
  },
  cache: {
    required: ["date", "cast", "shown", "structure"],
    optional: ["intention", "method", "rng"],
  },
  history: {
    required: ["date", "cast"],
    optional: ["intention", "timestamp", "method", "rng"],
  },
  // Reflection notes are written to the notes.jsonl sidecar beside
  // history.jsonl, so pre-note binaries never meet a record shape they cannot
  // parse. The `kind` discriminator still keeps any LEGACY note lines (written
  // into history.jsonl before the sidecar landed) out of entry reads.
  note: {
    required: ["kind", "ref", "date", "timestamp", "text"],
    optional: [],
  },
} as const satisfies Record<string, Shape>;
