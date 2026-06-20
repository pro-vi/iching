/**
 * Type guard — is `value` one of the literal strings in `options`? Accepts unknown
 * so it's safe over raw JSON and CLI input alike (the typeof check guards non-string
 * input), narrowing to the union on success. Both config surfaces use it — the CLI
 * `config set` validator and the stored-config loader — so they agree on exactly
 * what counts as a valid value.
 */
export function isOneOf<const T extends readonly string[]>(
  options: T,
  value: unknown,
): value is T[number] {
  return typeof value === "string" && options.includes(value as T[number]);
}
