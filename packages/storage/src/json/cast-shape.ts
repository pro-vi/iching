import type { Cast } from "@iching/core";

/** True for a King Wen number: an integer 1-64, so GUA[n - 1] is safe. */
function isKingWen(value: unknown): boolean {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 64;
}

/** True for a persisted Line: the object every line walker dereferences. */
function isLineShaped(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line.value === "number" &&
    typeof line.isYang === "boolean" &&
    typeof line.isChanging === "boolean"
  );
}

/**
 * Deep-validate a persisted cast — every field readers dereference without
 * guarding. primary indexes GUA[n - 1] everywhere (journal list/show, today,
 * cast replay); becoming does the same when non-null; the derived numbers
 * (nuclear/polarity/mirror/diagonal) index GUA in the hook's display cascade
 * and the detail scene; lines are walked as six {value,isYang,isChanging}
 * objects; changingPositions is joined and iterated. A record that fails any
 * of these would crash a reader exactly as hard as torn bytes, so the check
 * happens here — at read time, before anything is yielded. Every Cast ever
 * written carries all eight fields (the shape predates the first release),
 * so depth never rejects legitimate history.
 */
export function isCastShaped(value: unknown): value is Cast {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const cast = value as Record<string, unknown>;
  if (!isKingWen(cast.primary)) return false;
  if (cast.becoming !== null && !isKingWen(cast.becoming)) return false;
  if (!Array.isArray(cast.lines) || cast.lines.length !== 6 || !cast.lines.every(isLineShaped))
    return false;
  if (
    !Array.isArray(cast.changingPositions) ||
    !cast.changingPositions.every((p) => Number.isInteger(p))
  )
    return false;
  return (
    isKingWen(cast.nuclear) &&
    isKingWen(cast.polarity) &&
    isKingWen(cast.mirror) &&
    isKingWen(cast.diagonal)
  );
}
