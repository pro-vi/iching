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

  // Separator
  lines.push({ text: "" });
  lines.push({ text: "─".repeat(textWidth), fg: t.tertiary });
  lines.push({ text: "" });

  // Commentary sections
  const sections: [string, string][] = [
    ["大象傳", gua.dx],
    ["彖傳", gua.tu],
    ["Image", gua.en],
    ["Judgment", gua.te],
    ["Wilhelm", gua.w],
  ];

  for (const [label, text] of sections) {
    lines.push({ text: label, fg: t.accent, bold: true });
    const wrapped = wordWrap(text, textWidth);
    for (const wl of wrapped) {
      lines.push({ text: wl, fg: t.secondary });
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
      lines.push({ text: "" });
    }
  }

  // Separator before derived
  lines.push({ text: "─".repeat(textWidth), fg: t.tertiary });
  lines.push({ text: "" });

  // Derived hexagrams
  lines.push({ text: "Derived", fg: t.accent, bold: true });
  for (let i = 0; i < model.derivedLinks.length; i++) {
    const link = model.derivedLinks[i];
    const isSelected = model.focus === "derived" && model.derivedCursor === i;
    const marker = isSelected ? ">" : " ";
    lines.push({
      text: `${marker} ${link.labelCn} ${link.label.padEnd(10)} ${link.symbol} ${link.name}  ${link.ename}`,
      fg: isSelected ? t.primary : t.secondary,
    });
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
      : "Never cast";
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
      ? "↑↓ select  enter open  tab scroll  esc back"
      : "↑↓ scroll  tab derived  enter open  esc back";

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
