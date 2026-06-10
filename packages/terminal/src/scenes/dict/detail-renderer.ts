// DetailRenderer — render hexagram detail into CellBuffer

import type { CellBuffer } from "../../render/buffer.ts";
import type { SceneContext } from "../../scene/types.ts";
import type { DetailModel, DerivedLink } from "./detail-model.ts";
import type { DisplayLanguage } from "@iching/core";
import { toSimplified } from "@iching/core";
import { getTheme } from "../../color/theme.ts";
import { stringWidth, centerPad } from "../../layout/measure.ts";
import { wordWrap } from "./word-wrap.ts";
import { GLYPHS } from "../../glyphs.ts";
import { tr } from "../../i18n/messages.ts";
import { pageIndicator } from "../../widgets/scroll.ts";

const FOOTER_ROWS = 2;
const PADDING = 2;

/** Build the full content as an array of {text, style} lines */
export interface ContentLine {
  text: string;
  fg?: string;
  bold?: boolean;
  dim?: boolean;
}

export interface DetailRenderOptions {
  language?: DisplayLanguage;
}

const DEFAULT_LANGUAGE: DisplayLanguage = "en";

const TRIGRAM_IMAGE_ZH: Record<string, string> = {
  "乾": "天",
  "坤": "地",
  "震": "雷",
  "坎": "水",
  "艮": "山",
  "巽": "風",
  "離": "火",
  "兌": "澤",
};

function activeLanguage(options?: DetailRenderOptions): DisplayLanguage {
  return options?.language ?? DEFAULT_LANGUAGE;
}

function zh(text: string, language: DisplayLanguage): string {
  // Delegate to the audited core Traditional->Simplified converter (no naive
  // local map). zh-Hant returns text unchanged; only zh-Hans converts.
  if (language !== "zh-Hans") return text;
  return toSimplified(text);
}

function pushWrapped(
  lines: ContentLine[],
  text: string,
  width: number,
  style: Omit<ContentLine, "text">,
): void {
  for (const wl of wordWrap(text, width)) {
    lines.push({ text: wl, ...style });
  }
}

/** Build all content lines for the detail view */
export function buildContentLines(
  model: DetailModel,
  width: number,
  options?: DetailRenderOptions,
): ContentLine[] {
  const t = getTheme();
  const lines: ContentLine[] = [];
  const gua = model.detail.gua;
  const textWidth = width - PADDING * 2;
  const language = activeLanguage(options);
  const english = language === "en";

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
    ? english ? gua.ename : `${zh(gua.n, language)} ${gua.p}`
    : english ? `${gua.u} ${gua.ename}` : `${gua.u} ${zh(gua.n, language)} ${gua.p}`;
  lines.push({
    text: centerPad(headerText, textWidth),
    fg: t.primary,
    bold: true,
  });
  if (english) {
    lines.push({
      text: centerPad(`${zh(gua.n, "zh-Hant")} ${gua.p}`, textWidth),
      fg: t.accent,
    });
  }
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
  const trigramLine = english
    ? `${s.upper.sym} ${s.upper.img} above  ${s.lower.sym} ${s.lower.img}`
    : `${s.upper.sym} ${zh(s.upper.n, language)} ${zh(TRIGRAM_IMAGE_ZH[s.upper.n] ?? s.upper.img, language)} 上  ${s.lower.sym} ${zh(s.lower.n, language)} ${zh(TRIGRAM_IMAGE_ZH[s.lower.n] ?? s.lower.img, language)} 下`;
  lines.push({
    text: centerPad(trigramLine, textWidth),
    fg: t.secondary,
  });

  // Separator
  lines.push({ text: "" });
  lines.push({ text: "─".repeat(textWidth), fg: t.tertiary });
  lines.push({ text: "" });

  // Commentary sections
  const sections: [string, string][] = english
    ? [
        ["Image", gua.en],
        ["Judgment", gua.te],
        // "Wilhelm-inspired" (not bare "Wilhelm"): gua.w is interpretive advice
        // after Wilhelm, NOT a direct quotation (AC-010 attribution policy; C-005).
        ["Wilhelm-inspired", gua.w],
      ]
    : [
        [zh("大象傳", language), zh(gua.dx, language)],
        [zh("彖傳", language), zh(gua.tu, language)],
      ];

  for (const [label, text] of sections) {
    lines.push({ text: label, fg: t.accent, bold: true });
    pushWrapped(lines, text, textWidth, { fg: t.secondary });
    lines.push({ text: "" });
  }

  // Line interpretations (爻辭)
  if (gua.yao && gua.yao.length === 6) {
    lines.push({ text: "─".repeat(textWidth), fg: t.tertiary });
    lines.push({ text: "" });
    lines.push({ text: english ? "Line Texts" : zh("爻辭", language), fg: t.accent, bold: true });
    lines.push({ text: "" });

    // Display top-to-bottom (line 6 down to line 1) to match visual diagram
    for (let i = 5; i >= 0; i--) {
      if (english) {
        lines.push({ text: `Line ${i + 1}`, fg: t.secondary, bold: true });
        if (gua.yaoEn?.[i]) {
          pushWrapped(lines, gua.yaoEn[i], textWidth, { fg: t.tertiary });
        }
      } else {
        pushWrapped(lines, zh(gua.yao[i], language), textWidth, { fg: t.secondary });
      }
      lines.push({ text: "" });
    }
  }

  // Separator before derived
  lines.push({ text: "─".repeat(textWidth), fg: t.tertiary });
  lines.push({ text: "" });

  // Derived hexagrams
  lines.push({ text: english ? "Derived" : zh("衍卦", language), fg: t.accent, bold: true });
  for (let i = 0; i < model.derivedLinks.length; i++) {
    const link = model.derivedLinks[i];
    const isSelected = model.focus === "derived" && model.derivedCursor === i;
    const marker = isSelected ? ">" : " ";
    const text = english
      ? `${marker} ${link.label.padEnd(10)} ${link.symbol} ${link.ename}`
      : `${marker} ${zh(link.labelCn, language)} ${link.symbol} ${zh(link.name, language)}`;
    lines.push({
      text,
      fg: isSelected ? t.primary : t.secondary,
    });
  }

  // Locked pair
  if (model.detail.isLocked && model.detail.lockedPartner) {
    lines.push({ text: "" });
    const partner = model.detail.lockedPartner.gua;
    lines.push({
      text: english
        ? `Locked pair: ${partner.ename}`
        : `${zh("鎖定對卦", language)}: ${zh(partner.n, language)}`,
      fg: t.tertiary,
    });
  }

  lines.push({ text: "" });

  // Separator before history
  lines.push({ text: "─".repeat(textWidth), fg: t.tertiary });

  // History
  const historyText =
    model.castCount > 0
      ? english
        ? `Cast ${model.castCount} time${model.castCount !== 1 ? "s" : ""} (last: ${model.lastCastDate})`
        : `${zh("已占", language)} ${model.castCount} ${zh("次", language)} (${zh("最近", language)}: ${model.lastCastDate})`
      : english ? "No history" : zh("未有占記", language);
  lines.push({ text: historyText, fg: t.tertiary, dim: true });

  return lines;
}

/** Render the detail view */
export function renderDetail(
  frame: CellBuffer,
  model: DetailModel,
  ctx: SceneContext,
  options?: DetailRenderOptions,
): void {
  const contentLines = buildContentLines(model, ctx.cols, options);
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
  renderFooter(frame, model, ctx, activeLanguage(options));
}

function renderFooter(
  frame: CellBuffer,
  model: DetailModel,
  ctx: SceneContext,
  language: DisplayLanguage,
): void {
  const t = getTheme();
  const sepRow = ctx.rows - 2;
  const footerRow = ctx.rows - 1;

  frame.writeText(sepRow, 0, "─".repeat(ctx.cols), { fg: t.tertiary });

  const keys =
    model.focus === "derived"
      ? `[↑↓] ${tr(language, "verb.select")}  ·  [enter] ${tr(language, "verb.open")}  ·  [tab] ${tr(language, "verb.scroll")}  ·  [esc] ${tr(language, "verb.back")}`
      : `[↑↓] ${tr(language, "verb.scroll")}  ·  [tab] ${tr(language, "verb.derived")}  ·  [enter] ${tr(language, "verb.open")}  ·  [esc] ${tr(language, "verb.back")}`;

  // Hidden when content fits (vs the region's "1/1"); shows the page otherwise.
  const indicator =
    model.contentHeight > model.viewportHeight
      ? pageIndicator(model.scrollOffset, model.contentHeight, model.viewportHeight)
      : "";

  frame.writeText(footerRow, 1, keys, { fg: t.secondary });
  if (indicator) {
    frame.writeText(footerRow, ctx.cols - indicator.length - 1, indicator, {
      fg: t.tertiary,
    });
  }
}
