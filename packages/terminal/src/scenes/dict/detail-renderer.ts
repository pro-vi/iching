// DetailRenderer — render hexagram detail into CellBuffer

import type { CellBuffer } from "../../render/buffer.ts";
import type { SceneContext } from "../../scene/types.ts";
import type { DetailModel } from "./detail-model.ts";
import { getTheme } from "../../color/theme.ts";
import { centerPad } from "../../layout/measure.ts";
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
 * Used by the stacked-voice renderer for 卦辭 and similar surfaces that
 * stack a zh canonical row above one or more dim English voices.
 */
export interface VoiceNode {
  zh?: string;
  modernEn?: string;
  wilhelmEn?: string;
  leggeEn?: string;
}

type Theme = ReturnType<typeof getTheme>;
type ContentStyle = Omit<ContentLine, "text">;
type Gua = DetailModel["detail"]["gua"];
type Structure = DetailModel["detail"]["structure"];

// ─── shared helpers ──────────────────────────────────────────────────────────

/**
 * Wrap `text` to `textWidth` and push each wrapped row onto `lines` with the
 * given style. Compresses the `wordWrap` + `for` + `push` pattern that
 * appears across every per-section helper below.
 */
function pushWrapped(
  lines: ContentLine[],
  textWidth: number,
  text: string,
  style: ContentStyle,
): void {
  for (const wl of wordWrap(text, textWidth)) {
    lines.push({ text: wl, ...style });
  }
}

/**
 * Render a translation-voice stack: canonical zh + each populated English
 * voice in fixed order (modern → wilhelm-flavored → legge). Each voice row
 * only emits when its content exists, so future lineages plug in without
 * touching call sites. Empty input emits nothing.
 */
function renderStackedVoices(
  lines: ContentLine[],
  textWidth: number,
  t: Theme,
  node: VoiceNode,
): void {
  if (node.zh) pushWrapped(lines, textWidth, node.zh, { fg: t.primary });
  if (node.modernEn) pushWrapped(lines, textWidth, node.modernEn, { fg: t.secondary });
  if (node.wilhelmEn) pushWrapped(lines, textWidth, node.wilhelmEn, { fg: t.secondary, dim: true });
  if (node.leggeEn) pushWrapped(lines, textWidth, node.leggeEn, { fg: t.secondary, dim: true });
}

// ─── per-section builders ────────────────────────────────────────────────────

/** Reserve rows for the large glyph; the render pass fills them in. */
function renderGlyphPlaceholder(lines: ContentLine[], model: DetailModel): void {
  if (!model.glyphEntry) return;
  for (let r = 0; r < model.glyphEntry.height; r++) {
    lines.push({ text: "", _glyphRow: r } as ContentLine & { _glyphRow: number });
  }
  lines.push({ text: "" });
}

/** Centered name + pinyin + ename. Omits the Unicode symbol when a large glyph is present. */
function renderHeader(lines: ContentLine[], model: DetailModel, textWidth: number, t: Theme): void {
  const gua = model.detail.gua;
  const headerText = model.glyphEntry
    ? `${gua.n} ${gua.p}`
    : `${gua.u} ${gua.n} ${gua.p}`;
  lines.push({ text: centerPad(headerText, textWidth), fg: t.primary, bold: true });
  lines.push({ text: centerPad(gua.ename, textWidth), fg: t.accent });
  lines.push({ text: "" });
}

/** Yang/yin glyph stack rendered top-to-bottom (line 6 down to line 1) with a gap between trigrams. */
function renderLineDiagram(lines: ContentLine[], gua: Gua, textWidth: number, t: Theme): void {
  for (let i = 5; i >= 0; i--) {
    const lineChar = gua.l[i] === 1 ? GLYPHS.yangFinal : GLYPHS.yinFinal;
    lines.push({ text: centerPad(lineChar, textWidth), fg: t.primary });
    if (i === 3) lines.push({ text: "" });
  }
  lines.push({ text: "" });
}

/** Trigram info line + compact 說卦 catalogue (always when both trigrams have assoc populated). */
function renderTrigramCatalogue(
  lines: ContentLine[],
  s: Structure,
  textWidth: number,
  t: Theme,
): void {
  const trigramLine = `${s.upper.sym} ${s.upper.n} ${s.upper.img} above  ${s.lower.sym} ${s.lower.n} ${s.lower.img}`;
  lines.push({ text: centerPad(trigramLine, textWidth), fg: t.secondary });
  if (s.upper.assoc && s.lower.assoc) {
    const upperCat = `${s.upper.assoc.family} ${s.upper.assoc.body} ${s.upper.assoc.animal} ${s.upper.assoc.direction}`;
    const lowerCat = `${s.lower.assoc.family} ${s.lower.assoc.body} ${s.lower.assoc.animal} ${s.lower.assoc.direction}`;
    lines.push({
      text: centerPad(`${upperCat}  ·  ${lowerCat}`, textWidth),
      fg: t.tertiary,
      dim: true,
    });
  }
}

/** 卦辭 (root oracle). Gated on `gua.gc` presence. */
function renderCanonicalOracle(lines: ContentLine[], gua: Gua, textWidth: number, t: Theme): void {
  if (!gua.gc) return;
  lines.push({ text: "卦辭", fg: t.accent, bold: true });
  renderStackedVoices(lines, textWidth, t, { zh: gua.gc, leggeEn: gua.gcEn });
  lines.push({ text: "" });
}

/**
 * 大象傳 / 彖傳 / Image / Judgment / Wilhelm — each with an optional Legge
 * sibling row when applicable. The Judgment section deliberately has no
 * Legge sibling because Legge translates 卦辭 (already shown above), not
 * 彖傳 (which is what `gua.te` renders).
 */
function renderCommentarySections(lines: ContentLine[], gua: Gua, textWidth: number, t: Theme): void {
  type Section = { label: string; text: string; legge?: string };
  const sections: Section[] = [
    { label: "大象傳", text: gua.dx },
    { label: "彖傳", text: gua.tu },
    { label: "Image", text: gua.en, legge: gua.legge?.image },
    { label: "Judgment", text: gua.te },
    { label: "Wilhelm", text: gua.w },
  ];
  for (const section of sections) {
    lines.push({ text: section.label, fg: t.accent, bold: true });
    pushWrapped(lines, textWidth, section.text, { fg: t.secondary });
    if (section.legge) pushWrapped(lines, textWidth, section.legge, { fg: t.secondary, dim: true });
    lines.push({ text: "" });
  }
}

/**
 * 爻辭 block — for each of 6 lines: zh + yaoEn + legge.lines[i] + 小象 zh.
 * For hex 1 and 2, appends a trailing 用九 / 用六 section sourced from
 * Legge's 7th line (zh is not in `gua.yao`, sized 6).
 */
function renderYaoBlock(
  lines: ContentLine[],
  gua: Gua,
  kw: number,
  textWidth: number,
  t: Theme,
): void {
  if (!gua.yao || gua.yao.length !== 6) return;
  lines.push({ text: "─".repeat(textWidth), fg: t.tertiary });
  lines.push({ text: "" });
  lines.push({ text: "爻辭 Line Texts", fg: t.accent, bold: true });
  lines.push({ text: "" });

  for (let i = 5; i >= 0; i--) {
    pushWrapped(lines, textWidth, gua.yao[i], { fg: t.secondary });
    if (gua.yaoEn?.[i]) pushWrapped(lines, textWidth, gua.yaoEn[i], { fg: t.tertiary });
    if (gua.legge?.lines[i]) pushWrapped(lines, textWidth, gua.legge.lines[i], { fg: t.tertiary, dim: true });
    // 小象傳 — zh only (Legge does not translate per-line 小象; Appendix II not in our pull).
    if (gua.yaoXiao?.[i]) pushWrapped(lines, textWidth, gua.yaoXiao[i], { fg: t.tertiary, dim: true });
    lines.push({ text: "" });
  }

  if (gua.legge && gua.legge.lines.length > 6) {
    const label = kw === 1 ? "用九" : kw === 2 ? "用六" : "用爻";
    lines.push({ text: label, fg: t.accent, bold: true });
    for (let j = 6; j < gua.legge.lines.length; j++) {
      pushWrapped(lines, textWidth, gua.legge.lines[j], { fg: t.secondary, dim: true });
    }
    lines.push({ text: "" });
  }
}

/**
 * Relations block — numeric derivations with 說卦 chapter citations, then
 * the text-bearing 序卦 (sequence) + 雜卦 (contrast) rows. xuGua /
 * zaGuaPair are populated by buildConnections() for every valid hex 1..64.
 */
function renderRelationsBlock(
  lines: ContentLine[],
  model: DetailModel,
  textWidth: number,
  t: Theme,
): void {
  lines.push({ text: "─".repeat(textWidth), fg: t.tertiary });
  lines.push({ text: "" });
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
  if (connections.xuGua) {
    lines.push({ text: "" });
    pushWrapped(lines, textWidth, `序卦 ← ${connections.xuGua.text}`, { fg: t.secondary });
    if (connections.xuGua.textEn) {
      pushWrapped(lines, textWidth, connections.xuGua.textEn, { fg: t.tertiary, dim: true });
    }
  }
  if (connections.zaGuaPair) {
    const partners = connections.zaGuaPair.names.join(" · ");
    const suffix = partners.length > 0 ? `  (${partners})` : "";
    pushWrapped(lines, textWidth, `雜卦 ↔ ${connections.zaGuaPair.text}${suffix}`, { fg: t.secondary });
    if (connections.zaGuaPair.textEn) {
      pushWrapped(lines, textWidth, connections.zaGuaPair.textEn, { fg: t.tertiary, dim: true });
    }
  }
}

/** Locked-pair badge + history line. */
function renderFooterTrails(
  lines: ContentLine[],
  model: DetailModel,
  textWidth: number,
  t: Theme,
): void {
  if (model.detail.isLocked && model.detail.lockedPartner) {
    lines.push({ text: "" });
    lines.push({
      text: `🔒 Locked pair: ${model.detail.lockedPartner.gua.n}`,
      fg: t.tertiary,
    });
  }
  lines.push({ text: "" });
  lines.push({ text: "─".repeat(textWidth), fg: t.tertiary });
  const historyText =
    model.castCount > 0
      ? `Cast ${model.castCount} time${model.castCount !== 1 ? "s" : ""} (last: ${model.lastCastDate})`
      : "No history";
  lines.push({ text: historyText, fg: t.tertiary, dim: true });
}

// ─── orchestrator ────────────────────────────────────────────────────────────

/** Build all content lines for the detail view. */
export function buildContentLines(model: DetailModel, width: number): ContentLine[] {
  const t = getTheme();
  const lines: ContentLine[] = [];
  const textWidth = width - PADDING * 2;
  const gua = model.detail.gua;

  renderGlyphPlaceholder(lines, model);
  renderHeader(lines, model, textWidth, t);
  renderLineDiagram(lines, gua, textWidth, t);
  renderTrigramCatalogue(lines, model.detail.structure, textWidth, t);

  // Separator before the commentary block.
  lines.push({ text: "" });
  lines.push({ text: "─".repeat(textWidth), fg: t.tertiary });
  lines.push({ text: "" });

  renderCanonicalOracle(lines, gua, textWidth, t);
  renderCommentarySections(lines, gua, textWidth, t);
  renderYaoBlock(lines, gua, model.detail.kw, textWidth, t);
  renderRelationsBlock(lines, model, textWidth, t);
  renderFooterTrails(lines, model, textWidth, t);

  return lines;
}

// ─── render pipeline ─────────────────────────────────────────────────────────

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
          if (chars[c] === "⠀" || chars[c] === " ") continue;
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
      ? "[↑↓] select  ·  [enter] hex  ·  [s] chapter  ·  [tab] scroll  ·  [esc] back"
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
