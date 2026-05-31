import type { ShuoguaChapter, TrigramAssoc } from "../types.js";

/**
 * 說卦傳 — Discussion of the Trigrams.
 *
 * One of the Ten Wings of the I Ching. Composed ~5th-3rd century BCE
 * (Warring States / early Han); transmitted with the Yijing for over
 * 2,200 years. Public domain.
 *
 * Eleven chapters in the standard 王弼 / 孔穎達 division (周易正義):
 * - ch 1-3: cosmological framing — sages, yin-yang, three powers
 * - ch 4-6: trigram motion, seasonal cycle, summary
 * - ch 7:   core attributes (健順動入陷麗止說)
 * - ch 8:   animal associations (馬牛龍雞豕雉狗羊)
 * - ch 9:   body part associations (首腹足股耳目手口)
 * - ch 10:  family role associations (父母三男三女) via the 索 scheme
 * - ch 11:  extended polysemous associations — the richest catalogue
 *
 * Source: ctext.org/book-of-changes/shuo-gua/zh (primary), cross-checked
 * against zh.wikisource.org and 3 other PD I Ching repos.
 */
export const SHUOGUA: { chapters: ShuoguaChapter[] } = {
  chapters: [
    { n: 1, text: "昔者聖人之作《易》也，幽贊於神明而生蓍，參天兩地而倚數，觀變於陰陽而立卦，發揮於剛柔而生爻，和順於道德而理於義，窮理盡性以至於命。" },
    { n: 2, text: "昔者聖人之作《易》也，將以順性命之理，是以立天之道曰陰與陽，立地之道曰柔與剛，立人之道曰仁與義。兼三才而兩之，故《易》六畫而成卦。分陰分陽，迭用柔剛，故《易》六位而成章。" },
    { n: 3, text: "天地定位，山澤通氣，雷風相薄，水火不相射，八卦相錯。數往者順，知來者逆，是故《易》逆數也。" },
    { n: 4, text: "雷以動之，風以散之，雨以潤之，日以烜之，艮以止之，兌以說之，乾以君之，坤以藏之。" },
    { n: 5, text: "帝出乎震，齊乎巽，相見乎離，致役乎坤，說言乎兌，戰乎乾，勞乎坎，成言乎艮。萬物出乎震，震東方也。齊乎巽，巽東南也，齊也者，言萬物之絜齊也。離也者，明也，萬物皆相見，南方之卦也。聖人南面而聽天下，嚮明而治，蓋取諸此也。坤也者，地也，萬物皆致養焉，故曰致役乎坤。兌，正秋也，萬物之所說也，故曰說言乎兌。戰乎乾，乾，西北之卦也，言陰陽相薄也。坎者，水也，正北方之卦也，勞卦也，萬物之所歸也，故曰勞乎坎。艮，東北之卦也，萬物之所成終而所成始也，故曰成言乎艮。" },
    { n: 6, text: "神也者，妙萬物而為言者也。動萬物者莫疾乎雷，橈萬物者莫疾乎風，燥萬物者莫熯乎火，說萬物者莫說乎澤，潤萬物者莫潤乎水，終萬物始萬物者莫盛乎艮。故水火相逮，雷風不相悖，山澤通氣，然後能變化，既成萬物也。" },
    { n: 7, text: "乾，健也；坤，順也；震，動也；巽，入也；坎，陷也；離，麗也；艮，止也；兌，說也。" },
    { n: 8, text: "乾為馬，坤為牛，震為龍，巽為雞，坎為豕，離為雉，艮為狗，兌為羊。" },
    { n: 9, text: "乾為首，坤為腹，震為足，巽為股，坎為耳，離為目，艮為手，兌為口。" },
    { n: 10, text: "乾，天也，故稱乎父；坤，地也，故稱乎母。震一索而得男，故謂之長男；巽一索而得女，故謂之長女。坎再索而得男，故謂之中男；離再索而得女，故謂之中女。艮三索而得男，故謂之少男；兌三索而得女，故謂之少女。" },
    { n: 11, text: "乾為天，為圜，為君，為父，為玉，為金，為寒，為冰，為大赤，為良馬，為老馬，為瘠馬，為駁馬，為木果。坤為地，為母，為布，為釜，為吝嗇，為均，為子母牛，為大輿，為文，為眾，為柄，其於地也為黑。震為雷，為龍，為玄黃，為敷，為大塗，為長子，為決躁，為蒼筤竹，為萑葦；其於馬也，為善鳴，為馵足，為作足，為的顙；其於稼也，為反生；其究為健，為蕃鮮。巽為木，為風，為長女，為繩直，為工，為白，為長，為高，為進退，為不果，為臭；其於人也，為寡髮，為廣顙，為多白眼，為近利市三倍；其究為躁卦。坎為水，為溝瀆，為隱伏，為矯輮，為弓輪；其於人也，為加憂，為心病，為耳痛，為血卦，為赤；其於馬也，為美脊，為亟心，為下首，為薄蹄，為曳；其於輿也，為多眚，為通，為月，為盜；其於木也，為堅多心。離為火，為日，為電，為中女，為甲冑，為戈兵；其於人也，為大腹；為乾卦，為鱉，為蟹，為蠃，為蚌，為龜；其於木也，為科上槁。艮為山，為徑路，為小石，為門闕，為果蓏，為閽寺，為指，為狗，為鼠，為黔喙之屬；其於木也，為堅多節。兌為澤，為少女，為巫，為口舌，為毀折，為附決；其於地也，為剛鹵；為妾，為羊。" },
  ],
};

/**
 * Structured trigram catalogue from 說卦 chapters 7–11, keyed by
 * trigram zh character.
 *
 * Canonical fields (image, family, body, animal, direction, attribute,
 * extendedImages) are normalized to the pure canonical character per
 * 說卦 ch.7-10 — phonological variants and alternate images live in
 * `extendedImages` (e.g. 巽 carries both 風 and 木 there).
 *
 * Optional fields (season, cosmologicalRole, other) are editorial
 * synthesis with English glosses in parens — UI must label as derived.
 */
export const TRIGRAM_ASSOC: Record<string, TrigramAssoc> = {
  // qian — 乾
  "乾": {
    image: "天",
    family: "父",
    body: "首",
    animal: "馬",
    direction: "西北",
    attribute: "健",
    extendedImages: ["天", "圜", "君", "父", "玉", "金", "寒", "冰", "大赤", "良馬", "老馬", "瘠馬", "駁馬", "木果"],
    season: "立冬之際 (late autumn / early winter)",
    cosmologicalRole: "戰乎乾 (battle / clash of yin-yang)",
    other: "乾以君之 (Qian rules as sovereign)",
  },
  // kun — 坤
  "坤": {
    image: "地",
    family: "母",
    body: "腹",
    animal: "牛",
    direction: "西南",
    attribute: "順",
    extendedImages: ["地", "母", "布", "釜", "吝嗇", "均", "子母牛", "大輿", "文", "眾", "柄", "黑 (其於地也)"],
    season: "late summer (transition)",
    cosmologicalRole: "致役乎坤 (all things receive nourishment)",
    other: "坤以藏之 (Kun stores / conceals)",
  },
  // zhen — 震
  "震": {
    image: "雷",
    family: "長男",
    body: "足",
    animal: "龍",
    direction: "東",
    attribute: "動",
    extendedImages: ["雷", "龍", "玄黃", "敷", "大塗", "長子", "決躁", "蒼筤竹", "萑葦", "善鳴馬", "馵足馬", "作足馬", "的顙馬", "反生 (稼)", "健", "蕃鮮"],
    season: "spring",
    cosmologicalRole: "帝出乎震 (the Lord issues forth from Zhen)",
    other: "震一索而得男，故謂之長男；雷以動之",
  },
  // xun — 巽
  "巽": {
    image: "風",
    family: "長女",
    body: "股",
    animal: "雞",
    direction: "東南",
    attribute: "入",
    extendedImages: ["木", "風", "長女", "繩直", "工", "白", "長", "高", "進退", "不果", "臭", "寡髮", "廣顙", "多白眼", "近利市三倍", "躁卦 (其究)"],
    season: "late spring / early summer",
    cosmologicalRole: "齊乎巽 (all things become uniform / clean)",
    other: "巽一索而得女，故謂之長女；風以散之",
  },
  // kan — 坎
  "坎": {
    image: "水",
    family: "中男",
    body: "耳",
    animal: "豕",
    direction: "北",
    attribute: "陷",
    extendedImages: ["水", "溝瀆", "隱伏", "矯輮", "弓輪", "加憂", "心病", "耳痛", "血卦", "赤", "美脊馬", "亟心馬", "下首馬", "薄蹄馬", "曳馬", "多眚 (輿)", "通", "月", "盜", "堅多心 (木)"],
    season: "winter (正北方)",
    cosmologicalRole: "勞乎坎 (place of toil / where all things return)",
    other: "坎再索而得男，故謂之中男；雨以潤之 / 潤萬物者莫潤乎水",
  },
  // li — 離
  "離": {
    image: "火",
    family: "中女",
    body: "目",
    animal: "雉",
    direction: "南",
    attribute: "麗",
    extendedImages: ["火", "日", "電", "中女", "甲冑", "戈兵", "大腹", "乾卦 (drying)", "鱉", "蟹", "蠃", "蚌", "龜", "科上槁 (木)"],
    season: "summer",
    cosmologicalRole: "相見乎離 (all things see one another)",
    other: "離再索而得女，故謂之中女；日以烜之 / 燥萬物者莫熯乎火",
  },
  // gen — 艮
  "艮": {
    image: "山",
    family: "少男",
    body: "手",
    animal: "狗",
    direction: "東北",
    attribute: "止",
    extendedImages: ["山", "徑路", "小石", "門闕", "果蓏", "閽寺", "指", "狗", "鼠", "黔喙之屬", "堅多節 (木)"],
    season: "late winter / early spring (transition)",
    cosmologicalRole: "成言乎艮 (all things complete and begin anew)",
    other: "艮三索而得男，故謂之少男；艮以止之 / 終萬物始萬物者莫盛乎艮",
  },
  // dui — 兌
  "兌": {
    image: "澤",
    family: "少女",
    body: "口",
    animal: "羊",
    direction: "西",
    attribute: "說",
    extendedImages: ["澤", "少女", "巫", "口舌", "毀折", "附決", "剛鹵 (其於地也)", "妾", "羊"],
    season: "正秋 (mid-autumn)",
    cosmologicalRole: "說言乎兌 (all things rejoice)",
    other: "兌三索而得女，故謂之少女；兌以說之 / 說萬物者莫說乎澤",
  },
};

export const SHUOGUA_META = {
  source: "https://ctext.org/book-of-changes/shuo-gua/zh (Chinese Text Project — primary)",
  crossChecks: [
    "https://ctext.org/book-of-changes/shuo-gua",
    "https://www.eee-learning.com/book/eee67 (易學網)",
    "https://zhouyipro.com/shuogua.html",
    "https://www.yilusoso.com/yjrm/971/",
    "zh.wikisource.org 周易 / 周易正義 transmissions",
  ],
  license: "ancient classical Chinese, public domain (work composed before 200 BCE; over 2,200 years old)",
  chapterCount: 11,
} as const;
