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

/** Structure config for JSON output */
export function configToJson(
  key: string,
  value: unknown,
): Record<string, unknown> {
  return { key, value };
}
