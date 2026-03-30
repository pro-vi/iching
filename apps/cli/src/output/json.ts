import type { Cast, Hexagram, Style } from "@iching/core";
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
  return {
    question: question ?? null,
    primary: {
      number: cast.primary,
      name: primary.n,
      pinyin: primary.p,
      symbol: primary.u,
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
          symbol: becoming.u,
        }
      : null,
    changingPositions: cast.changingPositions,
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

/** Structure hexagram data for JSON output */
export function hexagramToJson(
  kw: number,
  hex: Hexagram,
): Record<string, unknown> {
  return {
    number: kw,
    name: hex.n,
    pinyin: hex.p,
    symbol: hex.u,
    lines: hex.l,
    commentary: {
      dx: hex.dx,
      tu: hex.tu,
      en: hex.en,
      te: hex.te,
      w: hex.w,
    },
  };
}

/** Structure config for JSON output */
export function configToJson(
  key: string,
  value: unknown,
): Record<string, unknown> {
  return { key, value };
}
