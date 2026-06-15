// Wilhelm-interpretive English judgments (卦辭), one per hexagram (King Wen
// order, index 0 = hexagram 1). These are interpretive English in the corpus's
// Wilhelm-Baynes register — distilled from the classical 卦辭 + Legge + the 彖傳
// — NOT a licensed quotation of Wilhelm/Baynes (same AC-010 policy as `yaoEn`).
// Legge's public-domain judgment stays in the corpus as `gcEn`; this is the
// unified-Wilhelm display text, with a future settings toggle in mind.

export const JUDGMENT_WILHELM: string[] = [
  // 1 乾 元亨，利貞
  "Sublime success — it furthers through perseverance.",
  // 2 坤 元亨，利牝馬之貞…安貞，吉
  "Sublime success through the mare's perseverance. Take the lead and you go astray; follow, and find your guide. Friends in the southwest, none in the northeast. Rest in steadfastness — fortune.",
  // 3 屯 元亨，利貞，勿用有攸往，利建侯
  "Great success through perseverance. Undertake nothing yet; it furthers to appoint helpers.",
  // 4 蒙 亨…初筮告，再三瀆…利貞
  "Success. I do not seek the young fool — he seeks me. The first asking is answered; ask twice, thrice, and it troubles — the troubled go untaught. It furthers to persevere.",
  // 5 需 有孚，光亨，貞吉。利涉大川
  "Wait, holding to your truth — radiant success. Perseverance brings fortune; it furthers to cross the great water.",
  // 6 訟 有孚，窒。惕中吉。終凶。利見大人，不利涉大川
  "Truth obstructed. Wary and centered — fortune; pressed to the bitter end — misfortune. It furthers to see the great one; it does not further to cross the great water.",
  // 7 師 貞，丈人，吉無咎
  "Perseverance, and a seasoned leader — fortune, and no blame.",
  // 8 比 吉。原筮元永貞，無咎。不寧方來，後夫凶
  "Holding together — fortune. Ask again: with lasting, firm constancy, no blame. The restless come to you; whoever comes too late meets misfortune.",
  // 9 小畜 亨。密雲不雨，自我西郊
  "Small taming succeeds. Dense clouds, no rain yet, drifting from our western fields.",
  // 10 履 履虎尾，不咥人，亨
  "Treading on the tiger's tail — it does not bite. Success.",
  // 11 泰 小往大來，吉亨
  "The small departs, the great arrives. Fortune. Success.",
  // 12 否 否之匪人，不利君子貞，大往小來
  "Standstill, set by the unworthy. It does not further the noble one's perseverance. The great departs, the small arrives.",
  // 13 同人 同人于野，亨。利涉大川，利君子貞
  "Fellowship in the open — success. It furthers to cross the great water; it furthers the noble one's perseverance.",
  // 14 大有 元亨
  "Great possession — sublime success.",
  // 15 謙 亨，君子有終
  "Modesty succeeds. The noble one carries it through to the end.",
  // 16 豫 利建侯，行師
  "It furthers to appoint helpers and set armies marching.",
  // 17 隨 元亨利貞，無咎
  "Following — sublime success through perseverance. No blame.",
  // 18 蠱 元亨，利涉大川。先甲三日，後甲三日
  "Work on what has decayed — sublime success. It furthers to cross the great water. Three days before the turning, three days after.",
  // 19 臨 元，亨，利，貞。至于八月有凶
  "Approach — sublime success through perseverance. By the eighth month comes misfortune.",
  // 20 觀 盥而不薦，有孚顒若
  "Contemplation. The hands washed, the offering not yet made — trust fills all with reverence.",
  // 21 噬嗑 亨。利用獄
  "Biting through brings success. It furthers to administer justice.",
  // 22 賁 亨。小利有攸往
  "Grace succeeds. In small things, it furthers to have somewhere to go.",
  // 23 剝 不利有攸往
  "Splitting apart. It does not further to go anywhere.",
  // 24 復 亨。出入無疾，朋來無咎…七日來復，利有攸往
  "Return — success. Going out and in without harm; friends come, no blame. The way turns back; in seven days it returns. It furthers to have somewhere to go.",
  // 25 无妄 元亨，利貞。其匪正有眚，不利有攸往
  "Innocence — sublime success through perseverance. Stray from what is right and you stumble; then it does not further to go anywhere.",
  // 26 大畜 利貞，不家食吉，利涉大川
  "Great taming. It furthers to persevere. Not eating at home — fortune. It furthers to cross the great water.",
  // 27 頤 貞吉。觀頤，自求口實
  "Nourishment — perseverance brings fortune. Watch what is nourished; see how one seeks to fill the mouth.",
  // 28 大過 棟橈，利有攸往，亨
  "The ridgepole sags. It furthers to have somewhere to go. Success.",
  // 29 坎 習坎，有孚，維心亨，行有尚
  "Danger upon danger. Hold to your truth and the heart wins through; action carries merit.",
  // 30 離 利貞，亨。畜牝牛，吉
  "The clinging — it furthers to persevere; success. Tend the cow's docility — fortune.",
  // 31 咸 咸，亨，利貞，取女吉
  "Influence succeeds; it furthers to persevere. To take a wife — fortune.",
  // 32 恆 亨，無咎，利貞，利有攸往
  "Duration — success, no blame. It furthers to persevere; it furthers to have somewhere to go.",
  // 33 遯 亨，小利貞
  "Retreat succeeds. In small things, it furthers to persevere.",
  // 34 大壯 利貞
  "Great power — it furthers to persevere.",
  // 35 晉 康侯用錫馬蕃庶，晝日三接
  "Progress. A prince favored with many horses, received three times in a day.",
  // 36 明夷 利艱貞
  "Darkening of the light. It furthers to persevere through hardship.",
  // 37 家人 利女貞
  "The family. It furthers the woman's perseverance.",
  // 38 睽 小事吉
  "Opposition. In small matters — fortune.",
  // 39 蹇 利西南，不利東北；利見大人，貞吉
  "Obstruction. The southwest furthers, the northeast does not. It furthers to see the great one; perseverance brings fortune.",
  // 40 解 利西南，無所往，其來復吉。有攸往，夙吉
  "Deliverance. The southwest furthers. With nowhere to go, return brings fortune; with somewhere to go, set out early — fortune.",
  // 41 損 有孚，元吉，無咎，可貞，利有攸往…二簋可用享
  "Decrease, held in trust — sublime fortune, no blame; perseverance holds, and it furthers to have somewhere to go. What does it ask? Two bowls of grain suffice to offer.",
  // 42 益 利有攸往，利涉大川
  "Increase. It furthers to have somewhere to go; it furthers to cross the great water.",
  // 43 夬 揚于王庭，孚號，有厲…不利即戎，利有攸往
  "Breakthrough, proclaimed in the king's court. Call out in truth; danger remains. Announce it in your own city; it does not further to take up arms. It furthers to have somewhere to go.",
  // 44 姤 女壯，勿用取女
  "Coming to meet — a bold, strong woman. Do not take such a wife.",
  // 45 萃 亨。王假有廟，利見大人，亨，利貞…利有攸往
  "Gathering — success. The king goes to his temple. It furthers to see the great one; success through perseverance. Great offerings bring fortune; it furthers to have somewhere to go.",
  // 46 升 元亨，用見大人，勿恤，南征吉
  "Pushing upward — sublime success. Go to see the great one; do not grieve. To advance south — fortune.",
  // 47 困 亨，貞，大人吉，無咎，有言不信
  "Oppression — yet success. For the steadfast great one, fortune, and no blame. Words now find no belief.",
  // 48 井 改邑不改井…羸其瓶，凶
  "The town may move, the well does not. It neither empties nor fills; all come and draw. But if the rope falls short and the jug breaks — misfortune.",
  // 49 革 巳日乃孚，元亨利貞，悔亡
  "Revolution — believed only once the day has come. Sublime success through perseverance. Remorse fades.",
  // 50 鼎 元吉，亨
  "The cauldron — sublime fortune. Success.",
  // 51 震 亨。震來虩虩，笑言啞啞。震驚百里，不喪匕鬯
  "Shock brings success. It comes with fear and trembling, then laughter and talk. It startles for a hundred miles, yet he does not let fall the sacred ladle.",
  // 52 艮 艮其背，不獲其身，行其庭，不見其人，無咎
  "Keeping still — still as the back, losing the sense of self; walking the courtyard, seeing no one there. No blame.",
  // 53 漸 女歸吉，利貞
  "Development. The maiden marries — fortune. It furthers to persevere.",
  // 54 歸妹 征凶，無攸利
  "The marrying maiden. To set out — misfortune; nothing furthers.",
  // 55 豐 亨，王假之，勿憂，宜日中
  "Abundance succeeds. The king attains it; do not grieve — be as the sun at noon.",
  // 56 旅 小亨，旅貞吉
  "The wanderer — small success. For the traveler, perseverance brings fortune.",
  // 57 巽 小亨，利攸往，利見大人
  "The gentle — small success. It furthers to have somewhere to go; it furthers to see the great one.",
  // 58 兌 亨，利貞
  "The joyous — success. It furthers to persevere.",
  // 59 渙 亨。王假有廟，利涉大川，利貞
  "Dispersion — success. The king goes to his temple. It furthers to cross the great water; it furthers to persevere.",
  // 60 節 亨。苦節，不可貞
  "Limitation succeeds. But bitter limits cannot be held to.",
  // 61 中孚 豚魚吉，利涉大川，利貞
  "Inner truth reaches even pigs and fish — fortune. It furthers to cross the great water; it furthers to persevere.",
  // 62 小過 亨，利貞，可小事，不可大事。飛鳥遺之音，不宜上，宜下，大吉
  "Small excess succeeds; it furthers to persevere. Small things, not great. The flying bird leaves its call — better to descend than to rise. Great fortune.",
  // 63 既濟 亨，小利貞，初吉終亂
  "Success in small things; it furthers to persevere. Fortune at the start, disorder at the end.",
  // 64 未濟 亨，小狐汔濟，濡其尾，無攸利
  "Before completion — success. The little fox, nearly across, wets its tail; nothing furthers.",
];
