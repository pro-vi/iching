// DetailRenderer — render hexagram detail into CellBuffer

import type { CellBuffer } from "../../render/buffer.ts";
import type { SceneContext } from "../../scene/types.ts";
import type { DetailModel, DerivedLink } from "./detail-model.ts";
import { getTheme } from "../../color/theme.ts";
import { stringWidth, centerPad } from "../../layout/measure.ts";
import { wordWrap } from "./word-wrap.ts";
import { GLYPHS } from "../../glyphs.ts";

const FOOTER_ROWS = 2;
const PADDING = 2;

/** Build the full content as an array of {text, style} lines */
export interface ContentLine {
  text: string;
  fg?: string;
  bold?: boolean;
  dim?: boolean;
}

/**
 * A multi-voice text node — canonical zh plus zero or more English voices.
 * Used by the stacked-voice renderer for Judgment / Image / line readings /
 * 卦辭 surfaces.
 */
export interface VoiceNode {
  zh?: string;
  modernEn?: string;
  wilhelmEn?: string;
  leggeEn?: string;
}

type Theme = ReturnType<typeof getTheme>;

/**
 * Render a translation-voice stack: canonical zh + each populated English
 * voice in fixed order (modern → wilhelm-flavored → legge). Each voice row
 * only emits when its content exists, so future lineages (Legge in U10)
 * plug in without touching call sites. Empty input emits nothing.
 */
function renderStackedVoices(
  lines: ContentLine[],
  textWidth: number,
  t: Theme,
  node: VoiceNode,
): void {
  const push = (text: string, fg: string | undefined, dim: boolean): void => {
    const wrapped = wordWrap(text, textWidth);
    for (const wl of wrapped) {
      lines.push({ text: wl, fg, dim });
    }
  };
  if (node.zh) push(node.zh, t.primary, false);
  if (node.modernEn) push(node.modernEn, t.secondary, false);
  if (node.wilhelmEn) push(node.wilhelmEn, t.secondary, true);
  if (node.leggeEn) push(node.leggeEn, t.secondary, true);
}

/** Build all content lines for the detail view */
export function buildContentLines(model: DetailModel, width: number): ContentLine[] {
  const t = getTheme();
  const lines: ContentLine[] = [];
  const gua = model.detail.gua;
  const textWidth = width - PADDING * 2;

  // Large glyph placeholder rows (scrolls with content)
  if (model.glyphEntry) {
    // Reserve rows for the glyph - render pass fills them in
    for (let r = 0; r < model.glyphEntry.height; r++) {
      lines.push({ text: "", _glyphRow: r } as ContentLine & { _glyphRow: number });
    }
    lines.push({ text: "" }); // spacer after glyph
  }

  // Header — centered name (omit Unicode symbol when glyph present)
  const headerText = model.glyphEntry
    ? `${gua.n} ${gua.p}`
    : `${gua.u} ${gua.n} ${gua.p}`;
  lines.push({
    text: centerPad(headerText, textWidth),
    fg: t.primary,
    bold: true,
  });
  lines.push({
    text: centerPad(gua.ename, textWidth),
    fg: t.accent,
  });
  lines.push({ text: "" });

  // Line diagram (top to bottom: line 6 down to line 1)
  for (let i = 5; i >= 0; i--) {
    const lineChar = gua.l[i] === 1 ? GLYPHS.yangFinal : GLYPHS.yinFinal;
    lines.push({ text: centerPad(lineChar, textWidth), fg: t.primary });
    // Add gap between upper and lower trigrams (after line 4, before line 3)
    if (i === 3) {
      lines.push({ text: "" });
    }
  }
  lines.push({ text: "" });

  // Trigram info
  const s = model.detail.structure;
  const trigramLine = `${s.upper.sym} ${s.upper.n} ${s.upper.img} above  ${s.lower.sym} ${s.lower.n} ${s.lower.img}`;
  lines.push({
    text: centerPad(trigramLine, textWidth),
    fg: t.secondary,
  });

  // Compact 說卦 trigram catalogue (family / body / animal / direction).
  // Always rendered when both trigrams have assoc populated (U4 ships this
  // for all 8 trigrams, so this branch fires on every cast).
  if (s.upper.assoc && s.lower.assoc) {
    const upperCat = `${s.upper.assoc.family} ${s.upper.assoc.body} ${s.upper.assoc.animal} ${s.upper.assoc.direction}`;
    const lowerCat = `${s.lower.assoc.family} ${s.lower.assoc.body} ${s.lower.assoc.animal} ${s.lower.assoc.direction}`;
    lines.push({
      text: centerPad(`${upperCat}  ·  ${lowerCat}`, textWidth),
      fg: t.tertiary,
      dim: true,
    });
  }

  // Separator
  lines.push({ text: "" });
  lines.push({ text: "─".repeat(textWidth), fg: t.tertiary });
  lines.push({ text: "" });

  // 卦辭 (root Judgment / oracle text). Gated on gua.gc — present after U8
  // backfills; absent for legacy data (renders nothing).
  if (gua.gc) {
    lines.push({ text: "卦辭", fg: t.accent, bold: true });
    renderStackedVoices(lines, textWidth, t, {
      zh: gua.gc,
      leggeEn: gua.gcEn,
    });
    lines.push({ text: "" });
  }

  // Commentary sections — each section's main text + (when populated) the
  // Legge voice as a dim sibling row. Activated by U10 once gua.legge is
  // backfilled; legacy entries (no legge) render unchanged.
  type Section = { label: string; text: string; legge?: string };
  const sections: Section[] = [
    { label: "大象傳", text: gua.dx },
    { label: "彖傳", text: gua.tu },
    { label: "Image", text: gua.en, legge: gua.legge?.image },
    // Judgment section: te = English of 彖傳 (commentary on 卦辭). Legge's
    // judgment translates the 卦辭 itself, which is already surfaced in the
    // 卦辭 section above — so no `legge` row here.
    { label: "Judgment", text: gua.te },
    { label: "Wilhelm", text: gua.w },
  ];

  for (const section of sections) {
    lines.push({ text: section.label, fg: t.accent, bold: true });
    const wrapped = wordWrap(section.text, textWidth);
    for (const wl of wrapped) {
      lines.push({ text: wl, fg: t.secondary });
    }
    if (section.legge) {
      const wrappedLegge = wordWrap(section.legge, textWidth);
      for (const wl of wrappedLegge) {
        lines.push({ text: wl, fg: t.secondary, dim: true });
      }
    }
    lines.push({ text: "" });
  }

  // Line interpretations (爻辭)
  if (gua.yao && gua.yao.length === 6) {
    lines.push({ text: "─".repeat(textWidth), fg: t.tertiary });
    lines.push({ text: "" });
    lines.push({ text: "爻辭 Line Texts", fg: t.accent, bold: true });
    lines.push({ text: "" });

    // Display top-to-bottom (line 6 down to line 1) to match visual diagram
    for (let i = 5; i >= 0; i--) {
      // Chinese line text
      const wrapped = wordWrap(gua.yao[i], textWidth);
      for (const wl of wrapped) {
        lines.push({ text: wl, fg: t.secondary });
      }
      // English translation
      if (gua.yaoEn && gua.yaoEn[i]) {
        const wrappedEn = wordWrap(gua.yaoEn[i], textWidth);
        for (const wl of wrappedEn) {
          lines.push({ text: wl, fg: t.tertiary });
        }
      }
      // Legge en (U10 — voice-stacked under the line translation).
      if (gua.legge && gua.legge.lines[i]) {
        const wrappedLegge = wordWrap(gua.legge.lines[i], textWidth);
        for (const wl of wrappedLegge) {
          lines.push({ text: wl, fg: t.tertiary, dim: true });
        }
      }
      // 小象傳 (per-line commentary). Gated on gua.yaoXiao — present after
      // U8 backfills; absent for legacy data. Legge does not translate
      // the per-line 小象 (Appendix II of his SBE volume isn't in our pull),
      // so no English voice for 小象 — zh only.
      if (gua.yaoXiao && gua.yaoXiao[i]) {
        const wrappedXiao = wordWrap(gua.yaoXiao[i], textWidth);
        for (const wl of wrappedXiao) {
          lines.push({ text: wl, fg: t.tertiary, dim: true });
        }
      }
      lines.push({ text: "" });
    }
    // 用九 / 用六 — the canonical 7th paragraph for hex 1 / hex 2. Only
    // Legge translates these in our pull; zh is not in gua.yao (which is
    // sized 6). Surface only when Legge supplies a 7th entry.
    if (gua.legge && gua.legge.lines.length > 6) {
      const label = model.detail.kw === 1 ? "用九" : model.detail.kw === 2 ? "用六" : "用爻";
      lines.push({ text: label, fg: t.accent, bold: true });
      for (let j = 6; j < gua.legge.lines.length; j++) {
        const wrapped = wordWrap(gua.legge.lines[j], textWidth);
        for (const wl of wrapped) {
          lines.push({ text: wl, fg: t.secondary, dim: true });
        }
      }
      lines.push({ text: "" });
    }
  }

  // Separator before derived
  lines.push({ text: "─".repeat(textWidth), fg: t.tertiary });
  lines.push({ text: "" });

  // Relations — numeric derivations with 說卦 chapter citations, then the
  // text-bearing rows for 序卦 (sequence narrative) and 雜卦 (contrast pair).
  // The numeric rows and citations always render. xuGua/zaGuaPair are
  // populated by U5's buildConnections() for every valid hex 1..64.
  lines.push({ text: "Relations", fg: t.accent, bold: true });
  const connections = model.detail.connections;
  const citationByOp = new Map(
    connections.shuoguaCitations.map((c) => [c.op, c.chapter]),
  );
  for (let i = 0; i < model.derivedLinks.length; i++) {
    const link = model.derivedLinks[i];
    const isSelected = model.focus === "derived" && model.derivedCursor === i;
    const marker = isSelected ? ">" : " ";
    const chapter = citationByOp.get(link.op);
    const citation = chapter !== undefined ? `  [說卦 ch.${chapter}]` : "";
    lines.push({
      text: `${marker} ${link.labelCn} ${link.label.padEnd(10)} ${link.symbol} ${link.name}  ${link.ename}${citation}`,
      fg: isSelected ? t.primary : t.secondary,
    });
  }
  // 序卦 — sequence narrative from the previous hexagram. zh text is
  // word-wrapped (matches the English branch — long entries for hex
  // 30/31 carry the merged cosmological preamble and exceeded the
  // terminal width without wrapping).
  if (connections.xuGua) {
    lines.push({ text: "" });
    const xuZh = wordWrap(`序卦 ← ${connections.xuGua.text}`, textWidth);
    for (const wl of xuZh) {
      lines.push({ text: wl, fg: t.secondary });
    }
    if (connections.xuGua.textEn) {
      const wrapped = wordWrap(connections.xuGua.textEn, textWidth);
      for (const wl of wrapped) {
        lines.push({ text: wl, fg: t.tertiary, dim: true });
      }
    }
  }
  // 雜卦 — contrastive pairing. zh wrapped symmetrically.
  if (connections.zaGuaPair) {
    const partners = connections.zaGuaPair.names.join(" · ");
    const suffix = partners.length > 0 ? `  (${partners})` : "";
    const zaZh = wordWrap(`雜卦 ↔ ${connections.zaGuaPair.text}${suffix}`, textWidth);
    for (const wl of zaZh) {
      lines.push({ text: wl, fg: t.secondary });
    }
    if (connections.zaGuaPair.textEn) {
      const wrapped = wordWrap(connections.zaGuaPair.textEn, textWidth);
      for (const wl of wrapped) {
        lines.push({ text: wl, fg: t.tertiary, dim: true });
      }
    }
  }

  // Locked pair
  if (model.detail.isLocked && model.detail.lockedPartner) {
    lines.push({ text: "" });
    lines.push({
      text: `🔒 Locked pair: ${model.detail.lockedPartner.gua.n}`,
      fg: t.tertiary,
    });
  }

  lines.push({ text: "" });

  // Separator before history
  lines.push({ text: "─".repeat(textWidth), fg: t.tertiary });

  // History
  const historyText =
    model.castCount > 0
      ? `Cast ${model.castCount} time${model.castCount !== 1 ? "s" : ""} (last: ${model.lastCastDate})`
      : "No history";
  lines.push({ text: historyText, fg: t.tertiary, dim: true });

  return lines;
}

/** Render the detail view */
export function renderDetail(
  frame: CellBuffer,
  model: DetailModel,
  ctx: SceneContext,
): void {
  const contentLines = buildContentLines(model, ctx.cols);
  model.contentHeight = contentLines.length;

  const visibleRows = ctx.rows - FOOTER_ROWS;
  const visibleEnd = Math.min(contentLines.length, model.scrollOffset + visibleRows);

  // Glyph rendering state
  const glyphEntry = model.glyphEntry;
  const glyphCol = glyphEntry
    ? Math.max(0, Math.floor((ctx.cols - glyphEntry.width) / 2))
    : 0;

  for (let i = model.scrollOffset; i < visibleEnd; i++) {
    const row = i - model.scrollOffset;
    if (row >= visibleRows) break;
    const line = contentLines[i] as ContentLine & { _glyphRow?: number };

    // Render glyph row via animator or static
    if (line._glyphRow !== undefined && glyphEntry) {
      const gr = line._glyphRow;
      if (model.glyphAnimator && !model.glyphAnimDone) {
        // Let the animator render just this row by rendering full glyph
        // but we only need to call render once for the visible portion.
        // We'll handle this below after the loop.
      } else {
        // Static glyph row
        const t = getTheme();
        const chars = [...(glyphEntry.rows[gr] ?? "")];
        for (let c = 0; c < chars.length; c++) {
          if (chars[c] === "\u2800" || chars[c] === " ") continue;
          frame.writeText(row, glyphCol + c, chars[c], { fg: t.primary });
        }
      }
      continue;
    }

    frame.writeText(row, PADDING, line.text, {
      fg: line.fg,
      bold: line.bold,
      dim: line.dim,
    });
  }

  // Animated glyph: render in one pass over the visible area
  if (model.glyphAnimator && !model.glyphAnimDone && glyphEntry) {
    // Calculate which glyph rows are visible
    const glyphStartLine = 0; // glyph rows start at content line 0
    const glyphEndLine = glyphEntry.height;
    const visStart = model.scrollOffset;
    const visEnd = model.scrollOffset + visibleRows;

    // Only render if any glyph rows are in view
    if (glyphStartLine < visEnd && glyphEndLine > visStart) {
      const screenRow = glyphStartLine - model.scrollOffset;
      model.glyphAnimator.render(frame, screenRow, glyphCol);
    }
  }

  // Footer
  renderFooter(frame, model, ctx);
}

function renderFooter(
  frame: CellBuffer,
  model: DetailModel,
  ctx: SceneContext,
): void {
  const t = getTheme();
  const sepRow = ctx.rows - 2;
  const footerRow = ctx.rows - 1;

  frame.writeText(sepRow, 0, "─".repeat(ctx.cols), { fg: t.tertiary });

  const keys =
    model.focus === "derived"
      ? "[↑↓] select  ·  [enter] open  ·  [tab] scroll  ·  [esc] back"
      : "[↑↓] scroll  ·  [tab] derived  ·  [enter] open  ·  [esc] back";

  const indicator =
    model.contentHeight > model.viewportHeight
      ? `${Math.floor(model.scrollOffset / model.viewportHeight) + 1}/${Math.ceil(model.contentHeight / model.viewportHeight)}`
      : "";

  frame.writeText(footerRow, 1, keys, { fg: t.secondary });
  if (indicator) {
    frame.writeText(footerRow, ctx.cols - indicator.length - 1, indicator, {
      fg: t.tertiary,
    });
  }
}
