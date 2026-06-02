import type { Cast, CastConnections, ShuoguaCitation, DerivedType } from "../types.js";
import { XU_GUA } from "../data/xugua.js";
import { ZA_GUA_BY_HEX } from "../data/zagua.js";
import { LEGGE_ZAGUA_BY_HEX } from "../data/legge.js";

/**
 * Static map: each derivation operation → the 說卦 chapter that grounds it
 * in canonical text. Used as the textual authority anchor on cast surfaces
 * — clicking a derivation badge opens the cited chapter.
 *
 * - nuclear (互卦):    ch.3 — 天地定位，山澤通氣，雷風相薄 (the trigram-cycle)
 * - polarity (錯卦):   ch.2 — 立天之道曰陰與陽 (the yin-yang complementary axis)
 * - mirror (綜卦):     ch.6 — 神也者妙萬物 (the vantage-flip insight)
 * - diagonal (對角卦): ch.6 — same authority as mirror (錯 ∘ 綜 composition)
 * - becoming (之卦):   ch.7 — 健順動入陷麗止說 (the operational core)
 */
const DERIVATION_CITATIONS: Record<DerivedType, number> = {
  nuclear: 3,
  polarity: 2,
  mirror: 6,
  becoming: 7,
  diagonal: 6,
};

const DERIVATION_ORDER: DerivedType[] = [
  "nuclear",
  "polarity",
  "mirror",
  "becoming",
  "diagonal",
];

const buildShuoguaCitations = (): ShuoguaCitation[] =>
  DERIVATION_ORDER.map((op) => ({ op, chapter: DERIVATION_CITATIONS[op] }));

/**
 * Build the text-bearing relations overlay for a cast.
 *
 * Pure lookup over XU_GUA (sequence narrative from the previous hexagram),
 * ZA_GUA_BY_HEX (contrast pair commentary), and the static 說卦 chapter
 * citations. Does not touch the numeric derivations (nuclear/polarity/
 * mirror/diagonal/becoming) — those remain pure functions in their own
 * modules.
 *
 * The signature accepts any object exposing `primary` — a full Cast at
 * runtime, or a synthesized `{ primary: kw }` from the HexagramDetail path
 * where no Cast exists.
 */
export function buildConnections(cast: Pick<Cast, "primary">): CastConnections {
  const result: CastConnections = { shuoguaCitations: buildShuoguaCitations() };
  const xu = XU_GUA[cast.primary - 1];
  if (xu) result.xuGua = xu;
  const za = ZA_GUA_BY_HEX[cast.primary];
  if (za) {
    // Overlay Legge English by hex number. The LEGGE_ZAGUA_BY_HEX index
    // reroutes documented Legge typography anomalies (pair=[41] → hex 39,
    // pair=[50,51] → hexes 49 + 50), so every hex 1..64 gets a non-undefined
    // couplet text. The undefined branch is kept defensively.
    const textEn = LEGGE_ZAGUA_BY_HEX[cast.primary];
    result.zaGuaPair = textEn !== undefined ? { ...za, textEn } : za;
  }
  return result;
}
