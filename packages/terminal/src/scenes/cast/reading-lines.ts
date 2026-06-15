// reading-lines.ts — pure construction of the reading panel's text lines.
//
// Extracted from reading-renderer.ts so the reveal layout (which budgets
// vertical space between the glyph, the title block, and these texts) can
// measure the panel without an import cycle. The texts a reading is made of
// follow readingFocus — Zhu Xi's 《易學啟蒙·考變占》 rule (see its doc): line 爻辭
// read top-down at 1–2 moving; both 卦辭 at 3; the becoming's UNCHANGED 爻辭 at
// 4–5; the becoming 卦辭 (用九/用六 on 乾/坤) at 6; the primary 卦辭 at 0. A single
// dim hint names which text it turns on, where that isn't self-evident. Quiet,
// observational, never interpretive.

import { type Cast, type DisplayLanguage, GUA, readingFocus, readingTexts, toSimplified } from "@iching/core";
import { wordWrap } from "../dict/word-wrap.ts";
import { tr } from "../../i18n/messages.ts";

export interface ReadingLine {
  text: string;
  role: "hint" | "text" | "more";
  /**
   * True on the one wrapped line that leads with a dim type-label
   * ("卦辭 · ", "Judgment · ", "4 · "). The renderer dims everything up to the
   * separator so the canonical text itself carries the weight — the same
   * label/subject hierarchy as the 觀象 pane. Continuation lines and the bare
   * zh 爻辭 (which the hint already names) carry no label.
   */
  labeled?: boolean;
}

/**
 * The one-line method hint — names which text the reading turns on (by the 啟蒙
 * rule), descriptive of primacy, never an imperative. Empty where the text's own
 * label already names it (0 lines → the 卦辭 label; 1 line → the 爻 label; the
 * 用九/用六 text labels itself).
 */
export function readingHint(cast: Cast, language: DisplayLanguage): string {
  const focus = readingFocus(cast);
  switch (focus.kind) {
    case "lines":
      return tr(language, "cast.hint.upperLeads");
    case "dualJudgment":
      return tr(language, "cast.hint.dualJudgment");
    case "stillLines":
      return tr(language, focus.positions.length > 1 ? "cast.hint.stillLines" : "cast.hint.stillLine");
    case "becoming":
      return tr(language, "cast.hint.becomingJudgment");
    default:
      return "";
  }
}

/**
 * Build the reading-panel lines, wrapped to `width` and truncated to
 * `maxRows` (a dim "…" row stands in for what didn't fit — the detail
 * view always holds the full texts).
 */
export function buildReadingLines(
  cast: Cast,
  language: DisplayLanguage,
  width: number,
  maxRows: number,
): ReadingLine[] {
  if (maxRows < 1 || width < 4) return [];

  const english = language === "en";
  const cn = (s: string): string => (language === "zh-Hans" ? toSimplified(s) : s);

  const lines: ReadingLine[] = [];

  // The method hint leads the panel (dim), where it isn't self-evident.
  const hint = readingHint(cast, language);
  if (hint) for (const wl of wordWrap(hint, width)) lines.push({ text: wl, role: "hint" });

  // `labeled` marks the first wrapped line when the text leads with a dim
  // type-label ("卦辭 · ", "Judgment · ", "4 · "); only that line bears it.
  const pushText = (text: string, labeled = false): void => {
    const wrapped = wordWrap(text, width);
    wrapped.forEach((wl, i) => {
      lines.push(labeled && i === 0 ? { text: wl, role: "text", labeled: true } : { text: wl, role: "text" });
    });
  };

  // The texts the reading turns on, ordered governing-first by the shared core
  // rule (readingTexts) — so the panel and the CLI never diverge. Two judgments
  // (3 moving) each carry their hexagram glyph+name to be told apart; a lone
  // judgment uses the plain text-type label. en shows the Wilhelm-interpretive
  // judgment (gcEnW), one register with the line texts; the zh 爻辭 stays bare
  // (it opens with its own line name 初九/上六…).
  const judgmentLabel = tr(language, "cast.judgment");
  const parts = readingTexts(cast);
  const dual = parts.filter((p) => p.kind === "judgment").length > 1;
  for (const part of parts) {
    const g = GUA[part.kw - 1];
    if (part.kind === "judgment") {
      const label = dual ? `${g.u} ${cn(g.n)}` : judgmentLabel;
      pushText(english ? `${label} · ${g.gcEnW}` : `${label} · ${cn(g.gc)}`, true);
    } else if (part.kind === "line") {
      if (english) pushText(`${part.position} · ${g.yaoEn[part.position - 1]}`, true);
      else pushText(cn(g.yao[part.position - 1]));
    } else if (g.extra) {
      pushText(english ? `${g.extra.name} · ${g.extra.textEn}` : `${cn(g.extra.name)} · ${cn(g.extra.text)}`, true);
    }
  }

  if (lines.length > maxRows) {
    // Only show the "…" when at least one oracle text survives above it — a
    // lone ellipsis (or a hint with no text beneath) is not a reading. The
    // renderer's contract is to skip cleanly and let the detail view be the
    // full reference, so drop the panel entirely in that case.
    const kept = lines.slice(0, Math.max(0, maxRows - 1));
    if (!kept.some((l) => l.role === "text")) return [];
    return [...kept, { text: "…", role: "more" }];
  }
  return lines;
}

/**
 * Rows the full (untruncated) panel wants at `width` — the figure the
 * settled-reveal layout reserves before the glyph gets to size itself.
 */
export function readingPanelRows(
  cast: Cast,
  language: DisplayLanguage,
  width: number,
): number {
  return buildReadingLines(cast, language, width, Number.MAX_SAFE_INTEGER).length;
}

/** Panel text width for a terminal width — single source for layout + render. */
export function readingPanelWidth(bufWidth: number): number {
  return Math.max(4, bufWidth - 8);
}
