import type { Cast, CastMethod, DailyCache, Hexagram, JournalPatterns, RngProvenance, Style, Structure } from "@iching/core";
import {
  GUA,
  STYLES,
  formatTrigrams,
  getStructure,
} from "@iching/core";
import type { HistoryEntry } from "@iching/core";
import { stripTerminalControls } from "@iching/storage";

/**
 * Quiet one-line entropy provenance, or null when there is nothing worth
 * saying. Plain crypto stays silent — the default needs no story, and silence
 * is calmer. "bound" and deterministic seeds get the honest label from
 * docs/vision/entropy-sources-vision.md (local participation, never a claim
 * of metaphysical efficacy).
 */
function entropyLine(rng?: RngProvenance, seed?: number): string | null {
  if (!rng) return null;
  if (rng.source === "seed") {
    return seed !== undefined
      ? `Entropy: deterministic replay from seed ${seed}.`
      : "Entropy: deterministic replay from seed.";
  }
  if (rng.source === "bound") {
    return rng.intentionBound
      ? "Entropy: local machine entropy, bound to the intention and moment."
      : "Entropy: local machine entropy, bound to the moment.";
  }
  return null; // crypto — the unremarkable default
}

/** Format a full reading as plain text */
export function formatCastPlain(
  cast: Cast,
  primary: Hexagram,
  structure: Structure,
  question?: string,
  rng?: RngProvenance,
  seed?: number,
): string {
  const lines: string[] = [];

  if (question) {
    lines.push(`Question: ${stripTerminalControls(question)}`);
    lines.push("");
  }

  // Primary hexagram
  const ename = primary.ename ? ` — ${primary.ename}` : "";
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
      `Becoming: ${b.u} ${b.n} (${b.p}) — Hexagram ${cast.becoming} [${cast.changingPositions.length === 1 ? "line" : "lines"} ${cast.changingPositions.join(",")}]`,
    );
    lines.push("");
  }

  // Judgment (卦辭) — the hexagram's own text
  lines.push(`Judgment (gc): ${primary.gc}`);
  lines.push(`Judgment (gcEn): ${primary.gcEn}`);
  lines.push("");

  // Changing lines — the texts the reading turns on
  if (cast.changingPositions.length > 0) {
    lines.push(cast.changingPositions.length === 1 ? "Changing line:" : "Changing lines:");
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

  // Entropy provenance — one quiet closing note, only when there is a story
  // to tell (bound / seed). Plain crypto stays silent.
  const entropy = entropyLine(rng, seed);
  if (entropy) {
    lines.push("");
    lines.push(entropy);
  }

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

  const ename = hex.ename ? ` — ${hex.ename}` : "";
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
    default: {
      // A method this build doesn't recognize — corrupt data, or a reading
      // written by a newer version that added a cast method. Show the raw name,
      // never "undefined" (the switch returns undefined without this). Parity
      // with parseLine skipping unknown record kinds: tolerate, don't garble.
      // The `never` binding keeps compile-time exhaustiveness — adding a
      // CastMethod errors here until it gets a real label — while the String()
      // still handles genuinely out-of-union runtime values (the erased type).
      const unknownMethod: never = method;
      return String(unknownMethod);
    }
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
    lines.push(`Intention: ${stripTerminalControls(cache.intention)}`);
  }
  if (cache.method) {
    lines.push(`Method: ${methodLabel(cache.method)}`);
  }
  lines.push("");
  lines.push(formatCastPlain(cast, primary, cache.structure, undefined, cache.rng));

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
    const intention = entry.intention ? `  "${stripTerminalControls(entry.intention)}"` : "";
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

  const ename = g.ename ? ` — ${g.ename}` : "";
  lines.push(`Date: ${entry.date}${entry.timestamp ? `  ${formatTime(entry.timestamp)}` : ""}`);
  if (entry.intention) {
    lines.push(`Intention: ${stripTerminalControls(entry.intention)}`);
  }
  if (entry.method) {
    lines.push(`Method: ${methodLabel(entry.method)}`);
  }
  // Quiet provenance note — only bound entries carry a story (seeded casts
  // never reach the journal; plain crypto stays silent).
  const entropy = entropyLine(entry.rng);
  if (entropy) {
    lines.push(entropy);
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
    const pos = entry.cast.changingPositions;
    lines.push("");
    lines.push(
      `Becoming: ${b.u} ${b.n} (${b.p}) — Hexagram ${entry.cast.becoming}` +
        (pos.length > 0 ? ` [${pos.length === 1 ? "line" : "lines"} ${pos.join(",")}]` : ""),
    );
  }

  // The moving lines are the crux of a reading — the very texts you sit with.
  // formatCastPlain prints them at cast time; revisiting the same reading via
  // `journal show` must surface them too, or a journalled reading silently loses
  // its moving lines once the fresh cast scrolls off. The entry stores
  // changingPositions, and isCastShaped guarantees they agree with the line
  // diagram, so the positions index the primary's yao texts directly.
  if (entry.cast.changingPositions.length > 0) {
    lines.push("");
    lines.push(entry.cast.changingPositions.length === 1 ? "Changing line:" : "Changing lines:");
    for (const pos of entry.cast.changingPositions) {
      lines.push(`  ${pos}: ${g.yao[pos - 1]}`);
      lines.push(`     ${g.yaoEn[pos - 1]}`);
    }
    // All six moving on hexagram 1/2 reads 用九/用六.
    if (entry.cast.changingPositions.length === 6 && g.extra) {
      lines.push(`  ${g.extra.name}: ${g.extra.text}`);
      lines.push(`     ${g.extra.textEn}`);
    }
  }

  lines.push("");
  lines.push(`大象 (dx): ${g.dx}`);
  lines.push(`Image (en): ${g.en}`);

  // Reflection notes — what happened after, written later. Text is stripped
  // of control characters at render time too: notes written by older
  // binaries (or hand-edited into the JSONL) must not replay ESC/OSC bytes
  // as live control sequences.
  if (notes && notes.length > 0) {
    lines.push("");
    lines.push("Notes:");
    for (const note of notes) {
      lines.push(`  ${note.date}  ${stripTerminalControls(note.text)}`);
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

/**
 * A concise plain-text digest of the journal patterns (`journal patterns`).
 * The TUI 觀象 pane is the rich view; this is the calm one-screen summary —
 * observation over what arrived, never prediction.
 */
export function formatJournalPatternsPlain(
  p: JournalPatterns,
  opts?: { omitThisMonth?: boolean },
): string {
  if (p.total === 0 || !p.cadence) return "No readings to observe yet.";
  const lines: string[] = [];
  const name = (kw: number): string => {
    const g = GUA[kw - 1];
    return g ? `${g.u} ${g.n} (${g.p})` : `#${kw}`;
  };

  // Under a historical window, "this month" is relative to real today, not the
  // period — always 0 and meaningless — so the caller drops it. The other
  // figures (span, active days, gaps) are window-internal and stand.
  lines.push(
    `${p.total} ${p.total === 1 ? "reading" : "readings"} · span ${p.cadence.spanDays}d · ${p.cadence.activeDays} active ${p.cadence.activeDays === 1 ? "day" : "days"}` +
      (opts?.omitThisMonth ? "" : ` · this month ${p.thisMonth}`),
  );
  lines.push(
    `Cadence: ${p.cadence.castsPerActiveDay.toFixed(1)}/active day` +
      (p.cadence.medianGapDays !== null ? ` · usual gap ${p.cadence.medianGapDays}d` : "") +
      (p.cadence.idleDays !== null ? ` · idle ${p.cadence.idleDays}d` : ""),
  );
  lines.push(
    `Diversity: seen ${p.diversity.distinctHexagrams} of 64` +
      (p.field.recent !== null ? ` · most recent ${name(p.field.recent)}` : ""),
  );
  if (p.timeOfDay) {
    const td = p.timeOfDay;
    // Circumstance, not a claim: the phase of day readings were recorded, over
    // the timestamped subset (n/total discloses entries without a usable hour).
    const timed = td.timestamped < p.total ? `${td.timestamped}/${p.total}` : `${td.timestamped}`;
    lines.push(
      `Phase of day (over ${timed} timed): ` +
        `dawn ${td.counts[0]} · midday ${td.counts[1]} · dusk ${td.counts[2]} · night ${td.counts[3]}`,
    );
  }

  if (p.topHexagrams.length > 0) {
    lines.push("");
    lines.push("Most seen:");
    for (const h of p.topHexagrams.slice(0, 5)) {
      lines.push(`  ${name(h.kw)} ×${h.count}  (${Math.round(h.share * 100)}%, last ${h.lastDate})`);
    }
  }

  lines.push("");
  lines.push(`Two modes (兩儀): yin ${p.lineBalance.yin} · yang ${p.lineBalance.yang}`);
  if (p.hammingDrift) {
    lines.push(`Drift between readings: ${p.hammingDrift.mean.toFixed(1)} of 6 lines, on average`);
  }
  const m = p.baseline.methods;
  lines.push(`Methods: coin ${m.coin} · yarrow ${m.yarrow}` + (m.unknown > 0 ? ` · unmarked ${m.unknown}` : ""));

  return lines.join("\n");
}
