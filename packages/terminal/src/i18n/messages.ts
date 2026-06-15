// Terminal UI message catalog — localizes EXISTING product-ui surfaces across
// EN / 繁 (zh-Hant) / 简 (zh-Hans). This is translation of strings that already
// exist in the scenes (menu labels, footer verbs, settings labels, empty states);
// it does NOT add new explanatory content or new UI. Classical-corpus text and
// machine tokens are NOT routed through here (see docs/language-glossary.md).
//
// zh-Hans is authored explicitly (not derived from zh-Hant) because UI vocabulary
// uses characters outside the corpus conversion table in @iching/core.
import type { DisplayLanguage } from "@iching/core";

export interface Message {
  en: string;
  zhHant: string;
  zhHans: string;
}

/** Catalog keyed by stable dotted id. Values are the existing UI strings localized. */
export const MESSAGES = {
  // ── home menu ──
  "menu.cast": { en: "Cast", zhHant: "起卦", zhHans: "起卦" },
  "menu.play": { en: "Play", zhHant: "演練", zhHans: "演练" },
  "menu.today": { en: "Today", zhHant: "今日", zhHans: "今日" },
  "menu.dictionary": { en: "Dictionary", zhHant: "卦典", zhHans: "卦典" },
  "menu.journal": { en: "Journal", zhHant: "占記", zhHans: "占记" },
  "menu.settings": { en: "Settings", zhHant: "設定", zhHans: "设定" },
  "menu.quit": { en: "Quit", zhHant: "離開", zhHans: "离开" },
  "home.today": { en: "Today:", zhHant: "今日：", zhHans: "今日：" },
  "home.noCast": { en: "No cast today", zhHant: "今日未占", zhHans: "今日未占" },

  // ── shared footer / keybinding verbs ──
  "verb.confirm": { en: "confirm", zhHant: "確認", zhHans: "确认" },
  "verb.back": { en: "back", zhHant: "返回", zhHans: "返回" },
  "verb.toss": { en: "toss", zhHant: "擲", zhHans: "掷" },
  "verb.reveal": { en: "reveal", zhHant: "顯示", zhHans: "显示" },
  "verb.discard": { en: "discard", zhHant: "捨棄", zhHans: "舍弃" },
  "verb.explore": { en: "explore", zhHant: "探看", zhHans: "探看" },
  "verb.switch": { en: "switch", zhHant: "切換", zhHans: "切换" },
  "verb.detail": { en: "detail", zhHant: "詳情", zhHans: "详情" },
  "verb.hideReading": { en: "hide reading", zhHant: "收起經文", zhHans: "收起经文" },
  "verb.showReading": { en: "show reading", zhHant: "展開經文", zhHans: "展开经文" },
  "verb.navigate": { en: "navigate", zhHant: "導覽", zhHans: "导览" },
  "verb.open": { en: "open", zhHant: "開啟", zhHans: "开启" },
  "verb.search": { en: "search", zhHant: "搜尋", zhHans: "搜寻" },
  "verb.clearSearch": { en: "clear search", zhHant: "清除搜尋", zhHans: "清除搜寻" },
  "verb.scroll": { en: "scroll", zhHant: "捲動", zhHans: "卷动" },
  "verb.derived": { en: "derived", zhHant: "衍卦", zhHans: "衍卦" },
  // Detail-view ←/→ walk of the King Wen sequence (KW ±1, wrapping).
  "verb.adjacent": { en: "adjacent", zhHant: "鄰卦", zhHans: "邻卦" },
  "verb.select": { en: "select", zhHant: "選擇", zhHans: "选择" },
  "verb.view": { en: "view", zhHant: "檢視", zhHans: "检视" },
  "verb.dictionary": { en: "dictionary", zhHant: "卦典", zhHans: "卦典" },
  "verb.setting": { en: "setting", zhHant: "設定", zhHans: "设定" },
  "verb.option": { en: "option", zhHant: "選項", zhHans: "选项" },
  "verb.saveBack": { en: "save & back", zhHant: "儲存並返回", zhHans: "储存并返回" },
  "verb.pause": { en: "pause", zhHant: "暫停", zhHans: "暂停" },
  "verb.resume": { en: "resume", zhHant: "繼續", zhHans: "继续" },
  "verb.step": { en: "step", zhHant: "單步", zhHans: "单步" },
  "verb.skip": { en: "skip", zhHant: "略過", zhHans: "略过" },
  "verb.speed": { en: "speed", zhHant: "速度", zhHans: "速度" },
  "verb.receiveReading": { en: "receive the reading", zhHant: "領受卦象", zhHans: "领受卦象" },
  "verb.beginCutting": { en: "begin cutting", zhHant: "開始分蓍", zhHans: "开始分蓍" },
  "verb.cut": { en: "cut", zhHant: "分蓍", zhHans: "分蓍" },
  "verb.cutAroundHere": { en: "cut around here", zhHant: "約此處分", zhHans: "约此处分" },
  "verb.note": { en: "note", zhHant: "註記", zhHans: "注记" },
  "verb.patterns": { en: "patterns", zhHant: "觀象", zhHans: "观象" },

  // ── loop-level notices ──
  // Shown (calm, centered) when the terminal is too small for honest layout.
  "notice.tooSmall": { en: "the window is too small", zhHant: "視窗過小", zhHans: "窗口过小" },

  // ── counters / structure (ritual chrome) ──
  "chrome.line": { en: "line", zhHant: "爻", zhHans: "爻" },
  "chrome.round": { en: "round", zhHant: "輪", zhHans: "轮" },
  // Connective joining the upper/lower trigram in the structure line ("X above Y").
  "cast.trigramConnective": { en: "above", zhHant: "上", zhHans: "上" },

  // ── reading panel (exploration phase) ──
  // Label prefixed to the 卦辭 when no lines move (the judgment IS the reading).
  // The becoming-judgment reading reuses this label (the hint + title already
  // name the becoming as the speaker, so it names only the text type).
  "cast.judgment": { en: "Judgment", zhHant: "卦辭", zhHans: "卦辞" },

  // ── dictionary chrome ──
  "dict.title": { en: "I Ching Dictionary", zhHant: "易經卦典", zhHans: "易经卦典" },
  "dict.searchPrompt": { en: "Search: ", zhHant: "搜尋：", zhHans: "搜寻：" },
  "dict.countSuffix": { en: "hexagrams", zhHant: "卦", zhHans: "卦" },
  // Singular for n=1 — English pluralizes ("1 hexagram"); zh 卦 is invariant.
  "dict.countSuffix.one": { en: "hexagram", zhHant: "卦", zhHans: "卦" },
  // Quiet centered hint when a search matches nothing (instead of a blank list).
  "dict.emptyHint": { en: "nothing answers · esc to clear", zhHant: "無所應 · esc 清除", zhHans: "无所应 · esc 清除" },

  // ── journal chrome ──
  "journal.title": { en: "Journal", zhHant: "占記", zhHans: "占记" },
  "journal.countSuffix": { en: "readings", zhHant: "則", zhHans: "则" },
  // Singular for n=1 — English pluralizes ("1 reading"); zh 則 is invariant.
  "journal.countSuffix.one": { en: "reading", zhHant: "則", zhHans: "则" },
  "journal.empty": { en: "No readings yet", zhHant: "尚無占記", zhHans: "尚无占记" },
  // A new journal's first impression: a quiet line under "No readings yet"
  // orienting what this space holds. Descriptive, never a prod to cast.
  "journal.emptyInvite": { en: "what you cast gathers here", zhHant: "所占聚於此", zhHans: "所占聚于此" },
  // Quiet centered hint when a search matches no reading (parallels dict.emptyHint).
  "journal.emptyHint": { en: "no reading answers that · esc to clear", zhHant: "無占應此 · esc 清除", zhHans: "无占应此 · esc 清除" },
  // Reflection notes — the quiet marker on annotated rows + the input prompt.
  "journal.noteMarker": { en: "note", zhHant: "註", zhHans: "注" },
  "journal.notePrompt": { en: "Note: ", zhHant: "註記：", zhHans: "注记：" },
  // One calm line when a note's append never reached disk (the marker is
  // withdrawn rather than rendering an unsaved note as kept). 儲存 follows
  // the ratified save register (verb.saveBack).
  "journal.noteSaveFailed": { en: "the note could not be saved", zhHant: "註記未能儲存", zhHans: "注记未能储存" },
  // Patterns pane — observation over the loaded entries, never a score.
  // 觀象 from 繫辭傳's 觀象玩辭 (observe the images, savor the words).
  // Section seals carry the classical term in every language (corpus
  // vocabulary, like 用九 in cast hints); en adds a plain gloss. The pane's
  // whole statistical register is "by chance ~" / 理數約 — observed counts sit
  // beside what the method's probabilities expect: observational, not explaining.
  "journal.patterns.head": { en: "觀象 · patterns", zhHant: "觀象", zhHans: "观象" },
  "journal.patterns.sectionFaces": { en: "卦象 · faces seen", zhHant: "卦象", zhHans: "卦象" },
  "journal.patterns.sectionLines": { en: "爻象 · where movement falls", zhHant: "爻象", zhHans: "爻象" },
  "journal.patterns.sectionTrigrams": { en: "八卦 · trigrams", zhHant: "八卦", zhHans: "八卦" },
  "journal.patterns.sectionSuccession": { en: "次第 · one cast to the next", zhHant: "次第", zhHans: "次第" },
  "journal.patterns.sectionTurnings": { en: "卦變 · turnings & echoes", zhHant: "卦變 · 錯綜", zhHans: "卦变 · 错综" },
  // 時 — a quiet mirror of the phase of day a reading was recorded, NOT a
  // claim about the user or the oracle. Four six-hour phases of the local day
  // (each spans three classical 時辰): 晨 卯辰巳 / 晝 午未申 / 暮 酉戌亥 / 夜 子丑寅.
  // A plain distribution, never a metric; the note names the honest population
  // (only readings with a recorded local hour) so the shape never over-reads
  // legacy entries. Title stays circumstantial ("phase of day"), not behavioural.
  "journal.patterns.sectionHours": { en: "時 · phase of day", zhHant: "時", zhHans: "时" },
  "journal.patterns.phaseDawn": { en: "dawn", zhHant: "晨", zhHans: "晨" },
  "journal.patterns.phaseMidday": { en: "midday", zhHant: "晝", zhHans: "昼" },
  "journal.patterns.phaseDusk": { en: "dusk", zhHant: "暮", zhHans: "暮" },
  "journal.patterns.phaseNight": { en: "night", zhHant: "夜", zhHans: "夜" },
  // Margin whisper after the count, e.g. "9/10 timed" / "9/10則記時" — the
  // fraction discloses readings without a usable local timestamp (omitted).
  "journal.patterns.timedSuffix": { en: " timed", zhHant: "則記時", zhHans: "则记时" },
  // 兩儀 coda — the yang/yin balance of every line drawn (易有太極，是生兩儀).
  "journal.patterns.sectionBalance": { en: "兩儀 · two modes", zhHant: "兩儀", zhHans: "两仪" },
  "journal.patterns.balanceYin": { en: "yin", zhHant: "陰", zhHans: "阴" },
  "journal.patterns.balanceYang": { en: "yang", zhHant: "陽", zhHans: "阳" },
  "journal.patterns.noData": { en: "no readings to analyze yet", zhHant: "尚無占記可觀", zhHans: "尚无占记可观" },
  "journal.patterns.days": { en: "d", zhHant: "日", zhHans: "日" },
  "journal.patterns.activeDays": { en: "active days", zhHant: "有占日", zhHans: "有占日" },
  "journal.patterns.thisMonth": { en: "this month", zhHant: "本月", zhHans: "本月" },
  "journal.patterns.recent30": { en: "30d", zhHant: "近30日", zhHans: "近30日" },
  "journal.patterns.idle": { en: "idle", zhHant: "未占", zhHans: "未占" },
  "journal.patterns.perActiveDay": { en: "/active day", zhHant: "/有占日", zhHans: "/有占日" },
  "journal.patterns.usualGap": { en: "usual gap", zhHant: "常隔", zhHans: "常隔" },
  "journal.patterns.longestGap": { en: "longest", zhHant: "最長", zhHans: "最长" },
  "journal.patterns.seenOf": { en: "seen", zhHant: "已見", zhHans: "已见" },
  "journal.patterns.ofSixtyFour": { en: "of 64", zhHant: "/ 64 卦", zhHans: "/ 64 卦" },
  "journal.patterns.recurrence": { en: "recurrence", zhHant: "重現", zhHans: "重现" },
  "journal.patterns.chanceSays": { en: "by chance ~", zhHant: "理數約", zhHans: "理数约" },
  "journal.patterns.chance": { en: "chance", zhHant: "理數", zhHans: "理数" },
  "journal.patterns.legendNever": { en: "not yet", zhHant: "未見", zhHans: "未见" },
  "journal.patterns.legendOnce": { en: "once", zhHant: "一度", zhHans: "一度" },
  "journal.patterns.legendFew": { en: "a few", zhHant: "數度", zhHans: "数度" },
  "journal.patterns.legendOften": { en: "often", zhHant: "屢見", zhHans: "屡见" },
  "journal.patterns.legendNow": { en: "now", zhHant: "此刻", zhHans: "此刻" },
  "journal.patterns.coin": { en: "coin", zhHant: "銅錢", zhHans: "铜钱" },
  "journal.patterns.yarrow": { en: "yarrow", zhHant: "蓍草", zhHans: "蓍草" },
  "journal.patterns.methodUnmarked": { en: "unmarked", zhHant: "未註法", zhHans: "未注法" },
  "journal.patterns.noBaseline": { en: "legacy entries only; baseline held back", zhHant: "僅有舊占記，暫不立基線", zhHans: "仅有旧占记，暂不立基线" },
  "journal.patterns.tooFew": { en: "too few readings yet to weigh against chance", zhHant: "占記尚少，未足與理數相較", zhHans: "占记尚少，未足与理数相较" },
  "journal.patterns.baselineRestPre": { en: "chance figures rest on the ", zhHant: "理數僅據已註法之 ", zhHans: "理数仅据已注法之 " },
  "journal.patterns.baselineRestPost": { en: " method-marked readings", zhHant: " 則", zhHans: " 则" },
  "journal.patterns.last": { en: "last", zhHant: "最近", zhHans: "最近" },
  "journal.patterns.line1": { en: "line 1 · 初", zhHant: "初爻", zhHans: "初爻" },
  "journal.patterns.line2": { en: "line 2 · 二", zhHant: "二爻", zhHans: "二爻" },
  "journal.patterns.line3": { en: "line 3 · 三", zhHant: "三爻", zhHans: "三爻" },
  "journal.patterns.line4": { en: "line 4 · 四", zhHant: "四爻", zhHans: "四爻" },
  "journal.patterns.line5": { en: "line 5 · 五", zhHant: "五爻", zhHans: "五爻" },
  "journal.patterns.line6": { en: "line 6 · 上", zhHant: "上爻", zhHans: "上爻" },
  "journal.patterns.movedPerCast": { en: "moved per cast", zhHant: "每占動爻", zhHans: "每占动爻" },
  "journal.patterns.eachLine": { en: "each line", zhHant: "每爻", zhHans: "每爻" },
  "journal.patterns.noMovement": { en: "no line has yet moved", zhHant: "未有動爻", zhHans: "未有动爻" },
  "journal.patterns.still": { en: "still", zhHant: "六爻皆靜", zhHans: "六爻皆静" },
  "journal.patterns.oldYangLabel": { en: "9 · old yang", zhHant: "老陽九", zhHans: "老阳九" },
  "journal.patterns.oldYinLabel": { en: "6 · old yin", zhHant: "老陰六", zhHans: "老阴六" },
  "journal.patterns.eachByChance": { en: "each by chance ~", zhHant: "各依理數約", zhHans: "各依理数约" },
  "journal.patterns.role": { en: "upper/lower", zhHant: "上/下", zhHans: "上/下" },
  "journal.patterns.castToCast": { en: "cast to cast", zhHant: "占間", zhHans: "占间" },
  "journal.patterns.linesDiffer": { en: "lines differing", zhHant: "異爻", zhHans: "异爻" },
  "journal.patterns.mean": { en: "mean", zhHant: "均值", zhHans: "均值" },
  "journal.patterns.nuclear": { en: "nuclear", zhHant: "互卦", zhHans: "互卦" },
  "journal.patterns.polarity": { en: "polarity", zhHant: "錯卦", zhHans: "错卦" },
  "journal.patterns.mirror": { en: "mirror", zhHant: "綜卦", zhHans: "综卦" },
  "journal.patterns.kingWenPair": { en: "pair", zhHant: "序對", zhHans: "序对" },

  // ── settings labels ──
  "settings.title": { en: "Settings", zhHant: "設定", zhHans: "设定" },
  "settings.theme": { en: "Theme", zhHant: "主題", zhHans: "主题" },
  "settings.language": { en: "Language", zhHant: "語言", zhHans: "语言" },
  "settings.taijitu": { en: "Taijitu", zhHant: "太極圖", zhHans: "太极图" },
  "settings.glyphAnimation": { en: "Glyph Animation", zhHant: "字形動畫", zhHans: "字形动画" },
  "settings.font": { en: "Font", zhHant: "字體", zhHans: "字体" },
  "settings.castMethod": { en: "Cast Method", zhHant: "起卦法", zhHans: "起卦法" },
  "settings.castMode": { en: "Cast Mode", zhHant: "起卦模式", zhHans: "起卦模式" },
  "settings.entropy": { en: "Entropy", zhHant: "隨機源", zhHans: "随机源" },
  "settings.preview": { en: "Preview:", zhHant: "預覽：", zhHans: "预览：" },
  // Entropy-preview tributary labels — the seed recipe's ingredients. Register
  // follows the ratified provenance language ("bound to the intention and
  // moment"); 機器/心念 echo the option chips (機器 / 繫於心念).
  "settings.entropyLane.machine": { en: "machine", zhHant: "機器", zhHans: "机器" },
  "settings.entropyLane.intention": { en: "intention", zhHant: "心念", zhHans: "心念" },
  "settings.entropyLane.moment": { en: "moment", zhHant: "此刻", zhHans: "此刻" },

  // ── yarrow ritual captions + line-values (classical terms, Agentify C-003) ──
  "yarrow.roundTitle": { en: "Round", zhHant: "變", zhHans: "变" },
  "yarrow.round": { en: "round", zhHant: "變", zhHans: "变" },
  "yarrow.stalks": { en: "stalks", zhHant: "策", zhHans: "策" },
  "yarrow.cutAt": { en: "Cut at k=", zhHant: "分於k=", zhHans: "分于k=" },
  "yarrow.heaps": { en: "heaps", zhHant: "二分", zhHans: "二分" },
  "yarrow.oneAside": { en: "One aside", zhHant: "掛一", zhHans: "挂一" },
  "yarrow.countByFours": { en: "Count each heap by fours.", zhHant: "每堆揲四", zhHans: "每堆揲四" },
  "yarrow.few": { en: "few", zhHant: "少", zhHans: "少" },
  "yarrow.many": { en: "many", zhHant: "多", zhHans: "多" },
  "yarrow.fuse": { en: "fuse", zhHant: "成爻", zhHans: "成爻" },
  "yarrow.carry": { en: "Carry", zhHant: "續", zhHans: "续" }, // C-004: 承策 was invented ritualese -> plain 續/续 (continue)
  "yarrow.remaining": { en: "Remaining", zhHant: "餘策", zhHans: "余策" },
  "yarrow.setAside": { en: "set aside", zhHant: "奇策", zhHans: "奇策" }, // C-004: 歸奇 (the action 歸奇於扐) -> 奇策 (the remainder bundle, what the count labels)
  "yarrow.lineValue.6": { en: "old yin", zhHant: "老陰", zhHans: "老阴" },
  "yarrow.lineValue.7": { en: "young yang", zhHant: "少陽", zhHans: "少阳" },
  "yarrow.lineValue.8": { en: "young yin", zhHant: "少陰", zhHans: "少阴" },
  "yarrow.lineValue.9": { en: "old yang", zhHant: "老陽", zhHans: "老阳" },
} as const satisfies Record<string, Message>;

export type MessageKey = keyof typeof MESSAGES;

/** Localize a UI message key for the active display language. */
export function tr(language: DisplayLanguage, key: MessageKey): string {
  const m = MESSAGES[key];
  return language === "en" ? m.en : language === "zh-Hant" ? m.zhHant : m.zhHans;
}

/**
 * The localized count unit for `n`, English-pluralized. The zh unit words
 * (則, 卦) are count-invariant, so only English distinguishes singular —
 * "1 reading" vs "2 readings". Pass the plural base key; its singular lives
 * at `${base}.one`. Returns the unit only (the patterns pane styles the
 * number and unit as separate spans, so it can't take a joined string).
 */
export function countUnit(
  language: DisplayLanguage,
  n: number,
  base: "journal.countSuffix" | "dict.countSuffix",
): string {
  return tr(language, (n === 1 ? `${base}.one` : base) as MessageKey);
}
