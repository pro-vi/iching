// Traditional -> Simplified (繁 -> 简) conversion for the I Ching corpus + UI.
//
// Zero runtime dependency (matches the embedded-data ethos of data/large-glyphs.ts).
// The table is AUDITED for the rendered corpus, not a naive partial map:
//   - covers every non-identity Traditional character in the 929-char rendered
//     corpus (hexagram names + 大象傳/彖傳/爻辭), sourced from Agentify consult
//     C-002 (see .loop/language/CONSULTS.md), plus the UI section-label/variant
//     characters (傳/辭/記/鎖/…) that the corpus extraction did not include;
//   - CANONICAL EXCEPTION: 乾 is deliberately ABSENT — in this corpus 乾 is
//     Heaven (乾卦) and must stay 乾, never become 干 (干 is the simplified of the
//     distinct char 幹, which IS mapped below). See docs/language-glossary.md.
//   - classical false-friends resolved one-directionally (繁->简 only): 後->后,
//     雲->云, 麗->丽 vs 離->离, 係/繫->系, 於->于, 穀->谷, 幾->几. 藉 is intentionally
//     NOT converted (易经「藉用白茅」keeps 藉).
//   - EXT-B RETENTION: 纆(hex29 徽纆)、餗(hex50 覆公餗)、繻(hex63 繻有衣袽) stay
//     Traditional. Their only standard simplification is a CJK Ext-B glyph
//     (𬙊/𫗧/𦈡, U+2xxxx) that renders as tofu in terminal fonts, so the readable
//     BMP Traditional form is kept deliberately. Listed in SIMPLIFIED_EXCEPTIONS.
//   - 祐->佑 (示, 自天祐之 hex14) is KEPT: 祐/佑 are interchangeable for 上天保佑 and
//     simplified 周易 editions conventionally print 自天佑之 (cf. 咷->啕, 遯->遁: the
//     table deliberately follows PRC convention past OpenCC's stricter t2s here).
//
// Conversion is one-directional (繁->简) and per-character; it is only ever applied
// to known Traditional source text, so the merge ambiguities of the reverse
// direction (简->繁) do not arise.

/**
 * Characters that must NEVER be auto-converted.
 *   - 乾: semantic-collision exception — Heaven (乾卦) must stay 乾, never 干.
 *   - 纆/餗/繻: Ext-B-tofu exception — standard simplification is an unreadable
 *     CJK Ext-B glyph (𬙊/𫗧/𦈡), so the BMP Traditional form is retained.
 *   - 繘 (hex48 卦辭 汔至亦未繘井): same Ext-B-tofu rationale — its only
 *     simplification is outside the BMP, so the Traditional form is kept.
 */
export const SIMPLIFIED_EXCEPTIONS: readonly string[] = ["乾", "纆", "餗", "繻", "繘"];

/** Audited Traditional -> Simplified character map (non-identity only). */
export const SIMPLIFIED_MAP: Readonly<Record<string, string>> = {
  // ── corpus map (Agentify C-002, audited) ──
  並: "并", 亂: "乱", 來: "来", 係: "系", 傾: "倾", 僕: "仆", 儀: "仪", 億: "亿",
  儉: "俭", 兌: "兑", 內: "内", 兩: "两", 則: "则", 剛: "刚", 剝: "剥", 動: "动",
  勝: "胜", 勞: "劳", 勢: "势", 勸: "劝", 厲: "厉", 叢: "丛", 咷: "啕", 問: "问",
  啞: "哑", 喪: "丧", 嚮: "向", 嚴: "严", 國: "国", 園: "园", 執: "执", 堅: "坚",
  塗: "涂", 壯: "壮", 奮: "奋", 婦: "妇", 宮: "宫", 實: "实", 寧: "宁", 寵: "宠",
  對: "对", 屨: "屦", 帥: "帅", 師: "师", 帶: "带", 幹: "干", 幾: "几", 廟: "庙",
  廬: "庐", 張: "张", 強: "强", 彙: "汇", 後: "后", 從: "从", 復: "复", 恆: "恒",
  悶: "闷", 惡: "恶", 惻: "恻", 慍: "愠", 慶: "庆", 憂: "忧", 應: "应", 懲: "惩",
  懷: "怀", 懼: "惧", 戔: "戋", 戰: "战", 戶: "户", 揚: "扬", 損: "损", 撝: "㧑",
  擊: "击", 據: "据", 攣: "挛", 敗: "败", 敵: "敌", 數: "数", 於: "于", 時: "时",
  晉: "晋", 曆: "历", 東: "东", 棄: "弃", 棟: "栋", 楊: "杨", 樂: "乐", 橈: "桡",
  機: "机", 歲: "岁", 歸: "归", 殺: "杀", 氣: "气", 決: "决", 況: "况", 淵: "渊",
  渙: "涣", 滅: "灭", 漣: "涟", 漸: "渐", 潛: "潜", 澤: "泽", 濟: "济", 災: "灾",
  為: "为", 無: "无", 爾: "尔", 牀: "床", 牽: "牵", 獄: "狱", 獨: "独", 獲: "获",
  瑣: "琐", 甕: "瓮", 異: "异", 當: "当", 疇: "畴", 發: "发", 眾: "众", 碩: "硕",
  祐: "佑", 祿: "禄", 禦: "御", 禮: "礼", 稱: "称", 穀: "谷", 積: "积", 窮: "穷",
  窺: "窥", 節: "节", 篤: "笃", 約: "约", 納: "纳", 紛: "纷", 紱: "绂", 終: "终",
  統: "统", 經: "经", 維: "维", 綸: "纶", 緩: "缓", 繫: "系", 繼: "继", 續: "续",
  罰: "罚", 罷: "罢", 義: "义", 習: "习", 聖: "圣", 聞: "闻", 膚: "肤", 臨: "临",
  與: "与", 興: "兴", 舊: "旧", 艱: "艰", 茲: "兹", 莧: "苋", 華: "华", 萬: "万",
  蒞: "莅", 薦: "荐", 藥: "药", 蘇: "苏", 處: "处", 虛: "虚", 號: "号", 虧: "亏",
  蠱: "蛊", 衛: "卫", 見: "见", 視: "视", 親: "亲", 覿: "觌", 觀: "观", 觸: "触",
  訟: "讼", 設: "设", 語: "语", 誡: "诫", 誥: "诰", 說: "说", 諸: "诸", 謀: "谋",
  謂: "谓", 謙: "谦", 講: "讲", 識: "识", 議: "议", 譽: "誉", 變: "变", 豐: "丰",
  豶: "豮", 貝: "贝", 貞: "贞", 負: "负", 財: "财", 貫: "贯", 貳: "贰", 賁: "贲",
  資: "资", 賓: "宾", 賞: "赏", 賢: "贤", 躋: "跻", 躍: "跃", 車: "车", 載: "载",
  輔: "辅", 輝: "辉", 輪: "轮", 輻: "辐", 輿: "舆", 連: "连", 進: "进", 過: "过",
  違: "违", 遠: "远", 遯: "遁", 遲: "迟", 遷: "迁", 遺: "遗", 鄰: "邻", 醜: "丑",
  鉉: "铉", 錫: "锡", 錯: "错", 長: "长", 門: "门", 閉: "闭", 開: "开", 閑: "闲",
  闃: "阒", 闚: "窥", 關: "关", 陰: "阴", 陸: "陆", 階: "阶", 隕: "陨", 隨: "随",
  險: "险", 雖: "虽", 離: "离", 難: "难", 雲: "云", 電: "电", 靈: "灵", 靜: "静",
  鞏: "巩", 頂: "顶", 順: "顺", 須: "须", 預: "预", 頤: "颐", 頰: "颊", 頻: "频",
  顒: "颙", 顛: "颠", 類: "类", 顯: "显", 風: "风", 飛: "飞", 飪: "饪", 飲: "饮",
  養: "养", 饋: "馈", 馬: "马", 馮: "冯", 驅: "驱", 魚: "鱼", 鮒: "鲋", 鳥: "鸟",
  鳴: "鸣", 鴻: "鸿", 鶴: "鹤", 麗: "丽", 黃: "黄", 齎: "赍", 龍: "龙", 龜: "龟",
  // ── UI section-label + variant supplements (vetted; not in corpus extraction) ──
  傳: "传", 辭: "辞", 記: "记", 鎖: "锁", 卽: "即", 嘆: "叹", 旣: "既", 矇: "蒙",
  結: "结", 羣: "群", 聽: "听", 趨: "趋", 跡: "迹", 麤: "粗", 縣: "县", 爲: "为",
  衆: "众", 裏: "里", 禍: "祸", 綜: "综", 羅: "罗", 殘: "残", 沒: "没", 樹: "树",
  斷: "断", 會: "会", 極: "极", 盜: "盗", 適: "适", 雜: "杂", 體: "体", 驚: "惊",
  餘: "余",
  // C-004 adversarial fix: 陰 was mapped but 陽 was not (asymmetry). 陽 is not in the
  // current corpus, but the pair is added for completeness/future-proofing.
  陽: "阳",
  // ── 卦辭/小象傳 corpus supplement (vetted; chars introduced by gc/yaoXiao/extra
  // in data/gua.ts that the original 929-char extraction did not include) ──
  馴: "驯", 貴: "贵", 賤: "贱", 縱: "纵", 瀆: "渎", 辯: "辩", 傷: "伤", 際: "际",
  願: "愿", 誰: "谁", 備: "备", 聰: "聪", 試: "试", 憊: "惫", 晝: "昼", 玆: "兹",
  愛: "爱", 飽: "饱", 絕: "绝", 暉: "晖",
};

/**
 * Convert Traditional Chinese text to Simplified using the audited corpus table.
 * Characters not in the map (including the 乾 exception and already-Simplified or
 * script-neutral characters) pass through unchanged.
 */
const EXCEPTION_SET = new Set(SIMPLIFIED_EXCEPTIONS);
export function toSimplified(text: string): string {
  let out = "";
  for (const ch of text) {
    // ENFORCE the exception list before the map — so 乾 can never be converted
    // even if a future table merge accidentally adds 乾: "干" (C-004 adversarial fix).
    out += EXCEPTION_SET.has(ch) ? ch : (SIMPLIFIED_MAP[ch] ?? ch);
  }
  return out;
}
