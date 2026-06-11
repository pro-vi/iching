import type { Cast, CastMethod, DailyCache, Hexagram, Style, Structure } from "@iching/core";
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
  const ename = (primary as any).ename ? ` — ${(primary as any).ename}` : "";
  lines.push(`${primary.u}  ${primary.n} (${primary.p})${ename} — Hexagram ${cast.primary}`);
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

  // Judgment (卦辭) — the hexagram's own text
  lines.push(`Judgment (gc): ${primary.gc}`);
  lines.push(`Judgment (gcEn): ${primary.gcEn}`);
  lines.push("");

  // Changing lines — the texts the reading turns on
  if (cast.changingPositions.length > 0) {
    lines.push("Changing lines:");
    for (const pos of cast.changingPositions) {
      lines.push(`  ${pos}: ${primary.yao[pos - 1]}`);
      lines.push(`     ${primary.yaoEn[pos - 1]}`);
    }
    // All six moving on hexagram 1/2 reads 用九/用六
    if (cast.changingPositions.length === 6 && primary.extra) {
      lines.push(`  ${primary.extra.name}: ${primary.extra.text}`);
      lines.push(`     ${primary.extra.textEn}`);
    }
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

  const ename = (hex as any).ename ? ` — ${(hex as any).ename}` : "";
  lines.push(`${hex.u}  ${hex.n} (${hex.p})${ename} — Hexagram ${kw}`);
  lines.push("");
  lines.push(
    `Upper: ${s.upper.sym} ${s.upper.n} (${s.upper.img})`,
  );
  lines.push(
    `Lower: ${s.lower.sym} ${s.lower.n} (${s.lower.img})`,
  );
  lines.push("");

  if (style && style !== "st") {
    // Show only requested commentary style. "st" means structure-only —
    // the trigram block above already covers it, so we skip the commentary.
    lines.push(hex[style]);
  } else if (!style) {
    // Show the judgment (卦辭) first, then all commentary styles
    lines.push(`Judgment (gc): ${hex.gc}`);
    lines.push(`Judgment (gcEn): ${hex.gcEn}`);
    lines.push(`大象 (dx): ${hex.dx}`);
    lines.push(`彖傳 (tu): ${hex.tu}`);
    lines.push(`Image (en): ${hex.en}`);
    lines.push(`Judgment (te): ${hex.te}`);
    lines.push(`Wilhelm (w): ${hex.w}`);
  }

  return lines.join("\n");
}

/** Quiet human label for cast-method provenance — a note, not a badge */
function methodLabel(method: CastMethod): string {
  switch (method) {
    case "coin":
      return "coins";
    case "coin-manual":
      return "coins, by hand";
    case "yarrow":
      return "yarrow stalks";
    case "yarrow-manual":
      return "yarrow stalks, by hand";
  }
}

/**
 * Format today's cached reading (`iching today`) as plain text — the full
 * reading (judgment, changing-line texts, commentary via formatCastPlain)
 * prefixed by the day's context: date, intention, method provenance.
 */
export function formatTodayPlain(cache: DailyCache): string {
  const cast = cache.cast;
  const primary = GUA[cast.primary - 1];
  const lines: string[] = [];

  lines.push(`Date: ${cache.date}`);
  if (cache.intention) {
    lines.push(`Intention: ${cache.intention}`);
  }
  if (cache.method) {
    lines.push(`Method: ${methodLabel(cache.method)}`);
  }
  lines.push("");
  lines.push(formatCastPlain(cast, primary, cache.structure));

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
    const time = entry.timestamp ? `  ${formatTime(entry.timestamp)}` : "";
    const intention = entry.intention ? `  "${entry.intention}"` : "";
    // Coins are the ambient default; only the slower rituals earn a quiet note.
    const method =
      entry.method && entry.method !== "coin" ? `  · ${methodLabel(entry.method)}` : "";
    lines.push(`${entry.date}${time}  ${g.u} ${g.n} (${g.p})${becoming}${intention}${method}`);
  }
  return lines.join("\n");
}

/** Format a single journal entry (show) as plain text, reflection notes beneath */
export function formatJournalShowPlain(
  entry: HistoryEntry,
  notes?: ReadonlyArray<{ date: string; text: string }>,
): string {
  const g = GUA[entry.cast.primary - 1];
  const structure = getStructure(entry.cast.primary);
  const lines: string[] = [];

  const ename = (g as any).ename ? ` — ${(g as any).ename}` : "";
  lines.push(`Date: ${entry.date}${entry.timestamp ? `  ${formatTime(entry.timestamp)}` : ""}`);
  if (entry.intention) {
    lines.push(`Intention: ${entry.intention}`);
  }
  if (entry.method) {
    lines.push(`Method: ${methodLabel(entry.method)}`);
  }
  lines.push(`${g.u}  ${g.n} (${g.p})${ename} — Hexagram ${entry.cast.primary}`);
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

  // Reflection notes — what happened after, written later.
  if (notes && notes.length > 0) {
    lines.push("");
    lines.push("Notes:");
    for (const note of notes) {
      lines.push(`  ${note.date}  ${note.text}`);
    }
  }

  return lines.join("\n");
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
