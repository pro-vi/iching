import type { Cast, DailyCache, Hexagram, HistoryEntry, Style } from "@iching/core";
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
    ...castToJson(cast, primary, becoming, cache.intention),
  };
}

/**
 * JSON shape for `iching today --json` when no reading exists yet today.
 * A state, not an error: stable keys, null payload, exit 0.
 */
export function noTodayToJson(date: string): Record<string, unknown> {
  return {
    date,
    intention: null,
    method: null,
    question: null,
    primary: null,
    becoming: null,
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
 * Additive: every original key is preserved unchanged.
 */
export function journalEntryToJson(entry: HistoryEntry): Record<string, unknown> {
  return {
    ...entry,
    primary: hexagramNames(entry.cast.primary),
    becoming: entry.cast.becoming !== null ? hexagramNames(entry.cast.becoming) : null,
  };
}

/** Structure config for JSON output */
export function configToJson(
  key: string,
  value: unknown,
): Record<string, unknown> {
  return { key, value };
}
