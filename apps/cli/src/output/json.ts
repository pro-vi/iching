import type { Cast, DailyCache, Hexagram, HistoryEntry, JournalPatterns, ReflectionNote, RngProvenance, Style } from "@iching/core";
import { GUA } from "@iching/core";
import type { UserConfig } from "@iching/storage";

/** Output any value as clean JSON (no ANSI) and exit */
export function outputJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

/** Structure cast data for JSON output */
export function castToJson(
  cast: Cast,
  primary: Hexagram,
  becoming: Hexagram | null,
  question?: string,
  rng?: RngProvenance,
  seed?: number,
): Record<string, unknown> {
  // Changing lines carry their oracle texts — the texts a reading turns on.
  // All six moving on hexagram 1/2 additionally reads 用九/用六 (extra).
  const changingLines = cast.changingPositions.map((pos) => ({
    position: pos,
    yao: primary.yao[pos - 1],
    yaoEn: primary.yaoEn[pos - 1],
  }));

  return {
    question: question ?? null,
    primary: {
      number: cast.primary,
      name: primary.n,
      pinyin: primary.p,
      ename: primary.ename,
      symbol: primary.u,
      judgment: { gc: primary.gc, gcEn: primary.gcEn },
      lines: cast.lines.map((l) => ({
        value: l.value,
        yang: l.isYang,
        changing: l.isChanging,
      })),
    },
    becoming: becoming
      ? {
          number: cast.becoming,
          name: becoming.n,
          pinyin: becoming.p,
          ename: becoming.ename,
          symbol: becoming.u,
          judgment: { gc: becoming.gc, gcEn: becoming.gcEn },
        }
      : null,
    changingPositions: cast.changingPositions,
    changingLines,
    extra:
      cast.changingPositions.length === 6 && primary.extra
        ? primary.extra
        : null,
    derived: {
      nuclear: cast.nuclear,
      polarity: cast.polarity,
      mirror: cast.mirror,
      diagonal: cast.diagonal,
    },
    commentary: {
      dx: primary.dx,
      tu: primary.tu,
      en: primary.en,
      te: primary.te,
      w: primary.w,
    },
    // Entropy provenance (additive; schemas only expand). An honest source
    // story — "bound" means the intention/moment participated as salt in
    // local machine entropy; never a claim of metaphysical efficacy.
    rng: rng
      ? {
          source: rng.source,
          intentionBound: rng.intentionBound,
          ...(rng.source === "seed" && seed !== undefined ? { seed } : {}),
        }
      : null,
  };
}

/**
 * Structure today's cached reading for JSON output (`iching today --json`):
 * the full castToJson payload plus the day's context (date/intention/method).
 * This is the one-call integration surface — an assistant can read the whole
 * reading without touching the cache file or the data tables.
 */
export function todayToJson(cache: DailyCache): Record<string, unknown> {
  const cast = cache.cast;
  const primary = GUA[cast.primary - 1];
  const becoming = cast.becoming !== null ? GUA[cast.becoming - 1] : null;
  return {
    date: cache.date,
    intention: cache.intention ?? null,
    method: cache.method ?? null,
    ...castToJson(cast, primary, becoming, cache.intention, cache.rng),
  };
}

/**
 * JSON shape for `iching today --json` when no reading exists yet today.
 * A state, not an error: the SAME key set as todayToJson with null (or [])
 * values, exit 0 — scripts never branch on key presence, only on values.
 */
export function noTodayToJson(date: string): Record<string, unknown> {
  return {
    date,
    intention: null,
    method: null,
    question: null,
    primary: null,
    becoming: null,
    changingPositions: [],
    changingLines: [],
    extra: null,
    derived: null,
    commentary: null,
    rng: null,
  };
}

/** Structure hexagram data for JSON output */
export function hexagramToJson(
  kw: number,
  hex: Hexagram,
): Record<string, unknown> {
  return {
    number: kw,
    name: hex.n,
    pinyin: hex.p,
    ename: hex.ename,
    symbol: hex.u,
    lines: hex.l,
    judgment: { gc: hex.gc, gcEn: hex.gcEn },
    lineTexts: hex.yao.map((yao, i) => ({
      position: i + 1,
      yao,
      yaoEn: hex.yaoEn[i],
      yaoXiao: hex.yaoXiao[i],
    })),
    extra: hex.extra ?? null,
    commentary: {
      dx: hex.dx,
      tu: hex.tu,
      en: hex.en,
      te: hex.te,
      w: hex.w,
    },
  };
}

/** Resolved name block for one hexagram by KW number */
function hexagramNames(kw: number): Record<string, unknown> {
  const hex = GUA[kw - 1];
  return { kw, n: hex.n, p: hex.p, ename: hex.ename, u: hex.u };
}

/**
 * Structure a journal entry for JSON output — the raw HistoryEntry fields
 * plus resolved primary/becoming names, so scripts don't need the data table.
 * Additive: every original key is preserved unchanged; `notes` appears only
 * when the caller supplies reflection notes.
 */
export function journalEntryToJson(
  entry: HistoryEntry,
  notes?: ReadonlyArray<ReflectionNote>,
): Record<string, unknown> {
  return {
    ...entry,
    primary: hexagramNames(entry.cast.primary),
    becoming: entry.cast.becoming !== null ? hexagramNames(entry.cast.becoming) : null,
    ...(notes !== undefined
      ? {
          notes: notes.map((n) => ({
            ref: n.ref,
            date: n.date,
            timestamp: n.timestamp,
            text: n.text,
          })),
        }
      : {}),
  };
}

/**
 * Structure the journal patterns for JSON output (`journal patterns --json`).
 * The same descriptive derivation the TUI 觀象 pane renders, made legible to a
 * script: kw references in the loved places (most-seen, recent, transitions)
 * are resolved to name blocks so a caller never needs the data table. Counts
 * and rates only — observation over what arrived, never prediction.
 */
export function journalPatternsToJson(p: JournalPatterns): Record<string, unknown> {
  const named = (kw: number): Record<string, unknown> => {
    const g = GUA[kw - 1];
    return g ? { kw, n: g.n, p: g.p, ename: g.ename, u: g.u } : { kw };
  };
  const pair = (from: number, to: number, count: number, lastDate?: string) => ({
    from: named(from),
    to: named(to),
    count,
    ...(lastDate !== undefined ? { lastDate } : {}),
  });
  return {
    // One note so a consuming script never crosses bases: descriptive `count`
    // fields tally every reading; a `comparison` block (when present) holds
    // chance figures computed ENTIRELY within the method-marked subset (coin/
    // yarrow casts, whose line probabilities are known). Never divide an
    // all-readings count by a method-marked expectation — use the comparison
    // block's own count/expected, which share a basis. `comparison` is null
    // when there is no method-marked baseline.
    basis: "count = all readings · comparison = method-marked subset only",
    total: p.total,
    thisMonth: p.thisMonth,
    cadence: p.cadence,
    diversity: p.diversity,
    baseline: p.baseline,
    lineBalance: p.lineBalance,
    field: {
      counts: p.field.counts,
      maxCount: p.field.maxCount,
      recent: p.field.recent !== null ? named(p.field.recent) : null,
    },
    topHexagrams: p.topHexagrams.map((h) => ({
      ...named(h.kw),
      count: h.count, // all readings of this primary
      share: h.share, // count / total
      lastDate: h.lastDate,
      // Same-basis comparison: method-marked count vs method-marked expectation.
      comparison:
        h.expected > 0
          ? { basis: "method-marked", count: h.knownCount, expected: h.expected, lift: h.lift }
          : null,
    })),
    movingLines: p.movingLines,
    movingLineCounts: p.movingLineCounts,
    topTrigrams: p.topTrigrams,
    topTransformations: p.topTransformations.map((t) => pair(t.from, t.to, t.count, t.lastDate)),
    topTransitions: p.topTransitions.map((t) => pair(t.from, t.to, t.count, t.lastDate)),
    topStructuralEchoes: p.topStructuralEchoes.map((e) =>
      e.kind === "kingWenPair"
        ? { kind: e.kind, pair: [e.pairStart, e.pairEnd], count: e.count, lastDate: e.lastDate }
        : { kind: e.kind, ...(e.kw !== undefined ? named(e.kw) : {}), count: e.count, lastDate: e.lastDate },
    ),
    hammingDrift: p.hammingDrift,
  };
}

/** Structure config for JSON output */
export function configToJson(
  key: string,
  value: unknown,
): Record<string, unknown> {
  return { key, value };
}
