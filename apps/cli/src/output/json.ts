import type { Cast, DailyCache, Hexagram, HistoryEntry, JournalPatterns, ReflectionNote, RngProvenance, Style } from "@iching/core";
import { GUA, readingTexts } from "@iching/core";
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
  // The lines that MOVED, with the primary's 爻辭 — factual (which lines changed),
  // kept for back-compat. This is NOT necessarily "the reading": see `reading`
  // below for the 啟蒙-selected texts (they differ at 3/4/5 moving lines).
  const changingLines = cast.changingPositions.map((pos) => ({
    position: pos,
    yao: primary.yao[pos - 1],
    yaoEn: primary.yaoEn[pos - 1],
  }));

  // The reading (啟蒙) — the ordered texts this cast turns on, from the shared
  // core rule (readingTexts), so plain / JSON / TUI never disagree. Governing
  // text first. Each entry carries its hexagram `kw` and the resolved texts.
  const reading = readingTexts(cast).map((part) => {
    const g = GUA[part.kw - 1];
    if (part.kind === "judgment") {
      return { kind: "judgment" as const, kw: part.kw, gc: g.gc, gcEn: g.gcEn };
    }
    if (part.kind === "line") {
      return {
        kind: "line" as const,
        kw: part.kw,
        position: part.position,
        yao: g.yao[part.position - 1],
        yaoEn: g.yaoEn[part.position - 1],
      };
    }
    return { kind: "extra" as const, kw: part.kw, name: g.extra?.name, text: g.extra?.text, textEn: g.extra?.textEn };
  });

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
    reading,
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
    reading: [],
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
  // An old-yang/yin direction comparison in the uniform block shape: the
  // method-marked observed named `count` (DirectionComparison calls it
  // `observed`), keeping `value` (6/9) as the line discriminant; `residual` is
  // dropped to match the other comparison blocks.
  const oldLine = (dir: { value: 6 | 9; observed: number; expected: number; lift: number | null }) => ({
    value: dir.value,
    count: dir.observed,
    expected: dir.expected,
    lift: dir.lift,
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
    // 時 — phase-of-day counts over the TIMESTAMPED subset (its own basis,
    // named by `timestamped`); legacy entries without a recorded hour are
    // excluded, never defaulted. Descriptive counts, no chance comparison.
    timeOfDay: p.timeOfDay
      ? {
          dawn: p.timeOfDay.counts[0],
          midday: p.timeOfDay.counts[1],
          dusk: p.timeOfDay.counts[2],
          night: p.timeOfDay.counts[3],
          timestamped: p.timeOfDay.timestamped,
        }
      : null,
    // Descriptive spread (all readings) at the top; the distinct-vs-expected
    // and repeats comparisons namespaced under the method-marked basis, so the
    // all-readings distinctHexagrams can't be divided by a method-only expected.
    diversity: {
      distinctHexagrams: p.diversity.distinctHexagrams,
      entropyBits: p.diversity.entropyBits,
      maxEntropyBits: p.diversity.maxEntropyBits,
      normalizedEntropy: p.diversity.normalizedEntropy,
      topShare: p.diversity.topShare,
      concentration: p.diversity.concentration,
      comparison:
        p.diversity.expectedDistinctHexagrams !== null
          ? {
              basis: "method-marked",
              distinctHexagrams: p.diversity.knownDistinctHexagrams,
              expectedDistinctHexagrams: p.diversity.expectedDistinctHexagrams,
              observedRepeats: p.diversity.observedRepeats,
              expectedRepeats: p.diversity.expectedRepeats,
              repeatLift: p.diversity.repeatLift,
            }
          : null,
    },
    // Method counts are descriptive; every method-marked chance figure — the
    // old-yang/yin comparisons and the uniform per-hexagram expectation — lives
    // under one `comparison` block so none of them sits loose where a script
    // could divide an all-readings count by it. Null when there is no baseline.
    baseline: {
      methods: p.baseline.methods,
      comparison:
        p.baseline.methods.known > 0
          ? {
              basis: "method-marked",
              expectedPerHexagram: p.baseline.primaryExpectedPerHexagram,
              // Uniform comparison shape — count/expected/lift, same as every
              // other block — so the README's "use the block's own count" holds
              // here too (DirectionComparison's field is named `observed`; the
              // line `value` 6/9 stays as the discriminant).
              oldYin: oldLine(p.baseline.oldYin),
              oldYang: oldLine(p.baseline.oldYang),
            }
          : null,
    },
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
    // Same comparison discipline as topHexagrams: descriptive count (all
    // readings) at the top, the method-marked chance comparison namespaced
    // (null when no baseline) — so a script never divides the two bases.
    movingLines: p.movingLines.map((l) => ({
      position: l.position,
      count: l.count,
      share: l.share,
      comparison:
        l.expected > 0
          ? { basis: "method-marked", count: l.knownCount, expected: l.expected, lift: l.lift }
          : null,
    })),
    movingLineCounts: p.movingLineCounts.map((b) => ({
      movingLines: b.movingLines,
      count: b.count,
      share: b.share,
      comparison:
        b.expected > 0
          ? { basis: "method-marked", count: b.knownCount, expected: b.expected, lift: b.lift }
          : null,
    })),
    // Same comparison discipline as topHexagrams/movingLines: descriptive
    // counts (all readings) at the top, the chance figure namespaced under the
    // method-marked basis — uniform 1/8 per trigram needs P(yang)=1/2, a
    // property of the method, so unknown-method readings don't inflate it.
    topTrigrams: p.topTrigrams.map((t) => ({
      index: t.index,
      count: t.count,
      upperCount: t.upperCount,
      lowerCount: t.lowerCount,
      share: t.share,
      comparison:
        t.expected > 0
          ? { basis: "method-marked", count: t.knownCount, expected: t.expected, lift: t.lift }
          : null,
    })),
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
