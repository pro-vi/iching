import type { Cast, Hexagram, Style, Structure } from "@iching/core";
import {
  GUA,
  STYLES,
  formatTrigrams,
  getStructure,
} from "@iching/core";
import type { HistoryEntry } from "@iching/core";

/** Format a full reading as plain text */
export function formatCastPlain(
  cast: Cast,
  primary: Hexagram,
  structure: Structure,
  question?: string,
): string {
  const lines: string[] = [];

  if (question) {
    lines.push(`Question: ${question}`);
    lines.push("");
  }

  // Primary hexagram
  lines.push(`${primary.u}  ${primary.n} (${primary.p}) — Hexagram ${cast.primary}`);
  lines.push("");

  // Line values
  lines.push("Lines (bottom to top):");
  for (let i = 0; i < cast.lines.length; i++) {
    const l = cast.lines[i];
    const type = l.isChanging
      ? l.isYang
        ? "old yang ⚊→⚋"
        : "old yin ⚋→⚊"
      : l.isYang
        ? "yang ⚊"
        : "yin ⚋";
    lines.push(`  ${i + 1}: ${l.value} (${type})`);
  }
  lines.push("");

  // Structure
  lines.push(
    `Upper: ${structure.upper.sym} ${structure.upper.n} (${structure.upper.img})`,
  );
  lines.push(
    `Lower: ${structure.lower.sym} ${structure.lower.n} (${structure.lower.img})`,
  );
  lines.push("");

  // Becoming
  if (cast.becoming !== null) {
    const b = GUA[cast.becoming - 1];
    lines.push(
      `Becoming: ${b.u} ${b.n} (${b.p}) — Hexagram ${cast.becoming} [lines ${cast.changingPositions.join(",")}]`,
    );
    lines.push("");
  }

  // Commentary
  lines.push("Commentary:");
  lines.push(`  大象 (dx): ${primary.dx}`);
  lines.push(`  彖傳 (tu): ${primary.tu}`);
  lines.push(`  Image (en): ${primary.en}`);
  lines.push(`  Judgment (te): ${primary.te}`);
  lines.push(`  Wilhelm (w): ${primary.w}`);

  return lines.join("\n");
}

/** Format hexagram lookup as plain text */
export function formatHexagramPlain(
  kw: number,
  hex: Hexagram,
  style?: Style,
): string {
  const lines: string[] = [];
  const s = getStructure(kw);

  lines.push(`${hex.u}  ${hex.n} (${hex.p}) — Hexagram ${kw}`);
  lines.push("");
  lines.push(
    `Upper: ${s.upper.sym} ${s.upper.n} (${s.upper.img})`,
  );
  lines.push(
    `Lower: ${s.lower.sym} ${s.lower.n} (${s.lower.img})`,
  );
  lines.push("");

  if (style) {
    // Show only requested style
    lines.push(hex[style]);
  } else {
    // Show all commentary styles
    lines.push(`大象 (dx): ${hex.dx}`);
    lines.push(`彖傳 (tu): ${hex.tu}`);
    lines.push(`Image (en): ${hex.en}`);
    lines.push(`Judgment (te): ${hex.te}`);
    lines.push(`Wilhelm (w): ${hex.w}`);
  }

  return lines.join("\n");
}

/** Format journal entry list as plain text */
export function formatJournalListPlain(
  entries: HistoryEntry[],
): string {
  if (entries.length === 0) return "No readings found.";

  const lines: string[] = [];
  for (const entry of entries) {
    const g = GUA[entry.cast.primary - 1];
    const becoming =
      entry.cast.becoming !== null
        ? ` → ${GUA[entry.cast.becoming - 1].u} ${GUA[entry.cast.becoming - 1].n}`
        : "";
    lines.push(`${entry.date}  ${g.u} ${g.n} (${g.p})${becoming}`);
  }
  return lines.join("\n");
}

/** Format a single journal entry (show) as plain text */
export function formatJournalShowPlain(entry: HistoryEntry): string {
  const g = GUA[entry.cast.primary - 1];
  const structure = getStructure(entry.cast.primary);
  const lines: string[] = [];

  lines.push(`Date: ${entry.date}`);
  lines.push(`${g.u}  ${g.n} (${g.p}) — Hexagram ${entry.cast.primary}`);
  lines.push("");
  lines.push(
    `Upper: ${structure.upper.sym} ${structure.upper.n} (${structure.upper.img})`,
  );
  lines.push(
    `Lower: ${structure.lower.sym} ${structure.lower.n} (${structure.lower.img})`,
  );

  if (entry.cast.becoming !== null) {
    const b = GUA[entry.cast.becoming - 1];
    lines.push("");
    lines.push(
      `Becoming: ${b.u} ${b.n} (${b.p}) — Hexagram ${entry.cast.becoming}`,
    );
  }

  lines.push("");
  lines.push(`大象 (dx): ${g.dx}`);
  lines.push(`Image (en): ${g.en}`);

  return lines.join("\n");
}
