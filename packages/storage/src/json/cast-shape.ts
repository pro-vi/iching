import type { Cast, Line } from "@iching/core";
import { assembleCast } from "@iching/core";

/** True for a King Wen number: an integer 1-64, so GUA[n - 1] is safe. */
function isKingWen(value: unknown): boolean {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 64;
}

/** True for a persisted Line: the object every line walker dereferences, with
 *  its value and booleans mutually consistent. */
function isLineShaped(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const line = value as Record<string, unknown>;
  if (
    typeof line.value !== "number" ||
    typeof line.isYang !== "boolean" ||
    typeof line.isChanging !== "boolean"
  )
    return false;
  // The value (6/7/8/9) fully determines isYang and isChanging, so a line where
  // they disagree is semantically false — it would draw yin while labeled 7, a
  // reading that looks valid but lies. isCastShaped exists to reject records
  // that "quietly mislead a reader" (see below), so enforce the relation, not
  // just the field types. 6 = old yin, 7 = young yang, 8 = young yin, 9 = old
  // yang (so isYang ⇔ 7|9, isChanging ⇔ 6|9).
  const v = line.value;
  if (v !== 6 && v !== 7 && v !== 8 && v !== 9) return false;
  return line.isYang === (v === 7 || v === 9) && line.isChanging === (v === 6 || v === 9);
}

/**
 * Deep-validate a persisted cast — every field readers dereference without
 * guarding. primary indexes GUA[n - 1] everywhere (journal list/show, today,
 * cast replay); becoming does the same when non-null; the derived numbers
 * (nuclear/polarity/mirror/diagonal) index GUA in the hook's display cascade
 * and the detail scene; lines are walked as six {value,isYang,isChanging}
 * objects whose value (6/7/8/9) agrees with isYang/isChanging; changingPositions
 * is joined and iterated, held to BOTH a range discipline (0–6 unique line
 * indices in 1–6) AND consistency — it must name exactly the lines whose
 * isChanging is true, so the reading-method rule (which reads changingPositions)
 * and the diagram (which reads lines[].isChanging) can never silently disagree.
 * A record that fails any of these would crash OR quietly mislead a reader —
 * present a reading that looks valid but lies — exactly as bad as torn bytes, so
 * the check happens here, at read time, before anything is yielded. Every Cast
 * ever written carries all eight fields in this shape, internally consistent (it
 * predates the first release), so depth never rejects legitimate history.
 */
export function isCastShaped(value: unknown): value is Cast {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const cast = value as Record<string, unknown>;
  if (!isKingWen(cast.primary)) return false;
  if (cast.becoming !== null && !isKingWen(cast.becoming)) return false;
  if (!Array.isArray(cast.lines) || cast.lines.length !== 6 || !cast.lines.every(isLineShaped))
    return false;
  if (!Array.isArray(cast.changingPositions)) return false;
  const positions = cast.changingPositions;
  if (
    positions.length > 6 ||
    !positions.every((p) => Number.isInteger(p) && p >= 1 && p <= 6) ||
    new Set(positions).size !== positions.length
  )
    return false;
  // changingPositions must name EXACTLY the moving lines, not merely be in
  // range: the reading-method rule reads changingPositions while the line
  // diagram reads lines[].isChanging, so a record where they disagree renders a
  // reading that looks valid but lies. Hold them to agreement. (External review.)
  const moving = (cast.lines as Array<{ isChanging: boolean }>).flatMap((line, i) =>
    line.isChanging ? [i + 1] : [],
  );
  const declared = [...(positions as number[])].sort((a, b) => a - b);
  if (declared.length !== moving.length || declared.some((p, i) => p !== moving[i]))
    return false;
  if (
    !isKingWen(cast.nuclear) ||
    !isKingWen(cast.polarity) ||
    !isKingWen(cast.mirror) ||
    !isKingWen(cast.diagonal)
  )
    return false;
  // The lines ARE the cast: primary, becoming, and the four derived hexagrams
  // are all DERIVED from them (assembleCast). A record can pass every check
  // above yet still carry a primary/becoming/derived that disagrees with its
  // lines — a hand-edited or imported row that draws hexagram 47's lines while
  // labeling them hexagram 12, displaying a plausible but false reading. The
  // lines are already validated internally consistent above, so reconstruct the
  // canonical cast from them and require the stored fields to match. (External
  // review: the top reading-integrity invariant.)
  const derived = assembleCast(cast.lines as Line[]);
  return (
    cast.primary === derived.primary &&
    cast.becoming === derived.becoming &&
    cast.nuclear === derived.nuclear &&
    cast.polarity === derived.polarity &&
    cast.mirror === derived.mirror &&
    cast.diagonal === derived.diagonal
  );
}
