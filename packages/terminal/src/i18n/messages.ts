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
  "cast.judgment": { en: "Judgment", zhHant: "卦辭", zhHans: "卦辞" },
  // One-line reading-method hints — the classical rule for which text governs,
  // stated observationally (one dim line, never a lecture).
  "cast.hint.one": { en: "one line moves — it speaks", zhHant: "一爻動，以動爻為占", zhHans: "一爻动，以动爻为占" },
  "cast.hint.two": { en: "two lines move — the upper governs", zhHant: "二爻動，以上爻為占", zhHans: "二爻动，以上爻为占" },
  "cast.hint.three": { en: "three lines move — the upper governs", zhHant: "三爻動，以上爻為占", zhHans: "三爻动，以上爻为占" },
  "cast.hint.four": { en: "four lines move — the becoming speaks", zhHant: "四爻動，以之卦為占", zhHans: "四爻动，以之卦为占" },
  "cast.hint.five": { en: "five lines move — the becoming speaks", zhHant: "五爻動，以之卦為占", zhHans: "五爻动，以之卦为占" },
  "cast.hint.all": { en: "all six lines move — the becoming speaks", zhHant: "六爻皆動，以之卦為占", zhHans: "六爻皆动，以之卦为占" },
  "cast.hint.allYong9": { en: "all six lines move — 用九 speaks", zhHant: "六爻皆動，以用九為占", zhHans: "六爻皆动，以用九为占" },
  "cast.hint.allYong6": { en: "all six lines move — 用六 speaks", zhHant: "六爻皆動，以用六為占", zhHans: "六爻皆动，以用六为占" },

  // ── dictionary chrome ──
  "dict.title": { en: "I Ching Dictionary", zhHant: "易經卦典", zhHans: "易经卦典" },
  "dict.searchPrompt": { en: "Search: ", zhHant: "搜尋：", zhHans: "搜寻：" },
  "dict.countSuffix": { en: "hexagrams", zhHant: "卦", zhHans: "卦" },
  // Quiet centered hint when a search matches nothing (instead of a blank list).
  "dict.emptyHint": { en: "nothing answers · esc to clear", zhHant: "無所應 · esc 清除", zhHans: "无所应 · esc 清除" },

  // ── journal chrome ──
  "journal.title": { en: "Journal", zhHant: "占記", zhHans: "占记" },
  "journal.countSuffix": { en: "readings", zhHant: "則", zhHans: "则" },
  "journal.empty": { en: "No readings yet", zhHant: "尚無占記", zhHans: "尚无占记" },
  // Reflection notes — the quiet marker on annotated rows + the input prompt.
  "journal.noteMarker": { en: "note", zhHant: "註", zhHans: "注" },
  "journal.notePrompt": { en: "Note: ", zhHant: "註記：", zhHans: "注记：" },
  // Patterns pane — observation over the loaded entries, never a score.
  // 觀象 from 繫辭傳's 觀象玩辭 (observe the images, savor the words).
  "journal.patterns.title": { en: "Patterns", zhHant: "觀象", zhHans: "观象" },
  "journal.patterns.thisMonth": { en: "this month", zhHant: "本月", zhHans: "本月" },
  "journal.patterns.mostSeen": { en: "most seen", zhHant: "最常見", zhHans: "最常见" },
  "journal.patterns.movingLine": { en: "moving line most often", zhHant: "動爻最常在", zhHans: "动爻最常在" },

  // ── settings labels ──
  "settings.title": { en: "Settings", zhHant: "設定", zhHans: "设定" },
  "settings.theme": { en: "Theme", zhHant: "主題", zhHans: "主题" },
  "settings.language": { en: "Language", zhHant: "語言", zhHans: "语言" },
  "settings.taijitu": { en: "Taijitu", zhHant: "太極圖", zhHans: "太极图" },
  "settings.glyphAnimation": { en: "Glyph Animation", zhHant: "字形動畫", zhHans: "字形动画" },
  "settings.font": { en: "Font", zhHant: "字體", zhHans: "字体" },
  "settings.castMethod": { en: "Cast Method", zhHant: "起卦法", zhHans: "起卦法" },
  "settings.castMode": { en: "Cast Mode", zhHant: "起卦模式", zhHans: "起卦模式" },
  "settings.preview": { en: "Preview:", zhHant: "預覽：", zhHans: "预览：" },

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
