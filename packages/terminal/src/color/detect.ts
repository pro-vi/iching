// Detect terminal color support from environment variables

export type ColorSupport = "truecolor" | "256" | "16" | "none";

/**
 * Detect color support level.
 * Check order: NO_COLOR -> COLORTERM -> TERM -> WT_SESSION -> default 16
 */
export function detectColorSupport(
  env: Record<string, string | undefined> = process.env,
): ColorSupport {
  // NO_COLOR spec: https://no-color.org/
  if (env.NO_COLOR !== undefined) return "none";

  // COLORTERM is set by many modern terminals
  const colorterm = env.COLORTERM?.toLowerCase();
  if (colorterm === "truecolor" || colorterm === "24bit") return "truecolor";

  // TERM often contains "256color"
  const term = env.TERM?.toLowerCase() ?? "";
  if (term.includes("256color")) return "256";

  // Windows Terminal sets WT_SESSION and supports truecolor
  if (env.WT_SESSION) return "truecolor";

  // Default to basic 16-color
  return "16";
}
