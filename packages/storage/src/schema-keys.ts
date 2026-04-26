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
      "theme",
      "color",
      "timezone",
      "glyphAnim",
      "glyphFont",
      "glyphSize",
      "taijituStyle",
    ],
    optional: [],
  },
  cache: {
    required: ["date", "cast", "shown", "structure"],
    optional: ["intention"],
  },
  history: {
    required: ["date", "cast"],
    optional: ["intention", "timestamp"],
  },
} as const satisfies Record<string, Shape>;
