/**
 * The Node errno code of a thrown filesystem error (ENOENT, EEXIST, EROFS, …), or
 * undefined when the throw isn't an errno error. Centralizes the
 * `as NodeJS.ErrnoException` cast every fs catch-block would otherwise repeat;
 * callers compare the code to the case they handle.
 */
export function errnoCode(err: unknown): string | undefined {
  return (err as NodeJS.ErrnoException).code;
}
