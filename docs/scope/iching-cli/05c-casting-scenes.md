# 05c: Casting Scenes

## Summary

Build the actual casting ritual scenes: coin toss animation, line formation, hexagram reveal, becoming transformation, and the interactive prompt. This is where the animation engine meets the domain — the visual divination experience.

## Design

### Module structure

```
packages/terminal/src/
├─ scenes/
│  ├─ cast/
│  │  ├─ cast-scene.ts          # main CastScene orchestrating the full ritual
│  │  ├─ model.ts               # CastModel: mutable scene state (coin positions, line progress, etc.)
│  │  ├─ coin-renderer.ts       # render coin spin/land/collapse animations
│  │  ├─ line-renderer.ts       # render line drawing center-outward (yang solid, yin with gap)
│  │  ├─ hexagram-renderer.ts   # render full hexagram with trigram gap + changing markers
│  │  ├─ reveal-renderer.ts     # render title block: Chinese name, pinyin, English
│  │  ├─ morph-renderer.ts      # render becoming transformation (line flip, bottom-to-top wave)
│  │  └─ timeline-builder.ts    # compose the full ritual timeline from DSL primitives
│  ├─ prompt/
│  │  └─ prompt-scene.ts        # post-cast interactive: [enter] reading, [j] journal, [q] quit
│  └─ journal/
│     └─ journal-scene.ts       # journal list/detail viewer (scrollable)
├─ glyphs.ts                    # Unicode constants: coins, lines, trigrams, hexagrams
```

### Glyph constants

```typescript
const GLYPHS = {
  coinIdle: "◌",
  coinSpin: ["◴", "◷", "◶", "◵"],         // quarter-circle rotation
  coinHeads: "●",                           // value 3
  coinTails: "○",                           // value 2

  yangFrames: [                             // center-outward, 15 cells
    "       ━       ",
    "      ━━━      ",
    "    ━━━━━━━    ",
    "   ━━━━━━━━━   ",
    "  ━━━━━━━━━━━  ",
    " ━━━━━━━━━━━━━ ",
    "━━━━━━━━━━━━━━━",
  ],
  yinFrames: [                              // center-outward with gap preserved
    "     ━   ━     ",
    "    ━━   ━━    ",
    "   ━━━   ━━━   ",
    "  ━━━━   ━━━━  ",
    " ━━━━━   ━━━━━ ",
    "━━━━━━   ━━━━━━",
  ],

  changingYangToYin: [                      // old yang → yin morph
    "━━━━━━━━━━━━━━━",
    "━━━━━━━ ━━━━━━━",
    "━━━━━━   ━━━━━━",
  ],
  changingYinToYang: [                      // old yin → yang morph
    "━━━━━━   ━━━━━━",
    "━━━━━━━ ━━━━━━━",
    "━━━━━━━━━━━━━━━",
  ],

  changingMarkerYang: "○",                  // old yang (9) gutter marker
  changingMarkerYin: "×",                   // old yin (6) gutter marker
};
```

### Stage layout

```
                                        row offsets from bottom anchor:
[coin toss row]                         -14
[air]                                   -13
━━━━━━━━━━━━━━━   line 6 (top)         -12
━━━━━━   ━━━━━━   line 5               -10
━━━━━━━━━━━━━━━   line 4               -8
                                        -6  (trigram gap: 2 blank rows)
━━━━━━   ━━━━━━   line 3               -5
━━━━━━━━━━━━━━━   line 2               -3
━━━━━━━━━━━━━━━   line 1 (bottom)      -1
[air]                                    0
      ䷿ 未濟                            +1  title
     Wèi Jì                             +2  pinyin
   Not Yet Fulfilled                     +3  English
     ☲ above ☵                           +4  trigram meta
[prompt]                                 +6
```

Trigram gap: 2 blank rows between lines 3 and 4.
Lines within a trigram: 1 blank row between.

### Ritual timeline composition

```typescript
function buildCastTimeline(cast: Cast, preset: MotionPreset): Step {
  return seq(
    wait(preset.startBreathMs),                    // opening breath
    ...cast.lines.map((line, i) => seq(
      castOneLine(i, line, preset),                // coin toss + line draw
      ...(i === 2 ? [wait(preset.afterLine3Ms)] : []),  // trigram recognition beat
      ...(i === 4 ? [wait(preset.afterLine5Ms)] : []),
    )),
    wait(preset.finalStillMs),                     // 1100ms silence — the reveal
    call(ctx => ctx.glowAllLines()),               // whole-figure breath
    wait(preset.finalGlowDownMs),
    revealTitle(cast),                             // name fades in
    ...(cast.becoming !== null ? [
      wait(680),                                   // primary exists alone
      pulseChangingMarkers(cast),                  // markers pulse together
      morphToBecoming(cast),                       // bottom-to-top wave
      revealBecomingTitle(cast),
    ] : [
      wait(1200),                                  // unchanging — longer hold
      call(ctx => ctx.showSubtitle("unchanging")),
    ]),
    call(ctx => ctx.showPrompt()),                 // interactive prompt
  );
}
```

### Coin animation details

- 3 coins out of phase: stagger [0ms, 60ms, 120ms]
- Spin: 9 frames × 80ms using ◴ ◷ ◶ ◵ rotation
- Color ramp: mist → stone → gold on landing
- Landing: sequential (120ms between each coin settling)
- Collapse: ● ○ ● → ● ○ ● → ••• → • (center dot on target line row)

### Line drawing details

- Center-outward expansion
- Yang: 7 frames × 80ms, ─ (thin) → ━ (heavy) in final 2 frames ("ink settling")
- Yin: 6 frames × 80ms, gap preserved from first frame
- Color ramp: ash → stone → bone
- Changing line pulse after settle: bone → gold/moon → brightGold/moon → gold/moon (320ms)
- Gutter marker (○ or ×) appears on second pulse frame

### Humanization

- ±10-15ms jitter on frame timing (prevent metronomic feel)
- Extra 80-120ms hold on changing lines
- All six lines changing: skip individual markers, one global flood pulse + crossfade morph

## Scope

### Files

- All files listed in module structure above
- `packages/terminal/src/__tests__/cast-scene.test.ts`
- `packages/terminal/src/__tests__/coin-renderer.test.ts`
- `packages/terminal/src/__tests__/line-renderer.test.ts`
- `packages/terminal/src/__tests__/morph-renderer.test.ts`
- `packages/terminal/src/__tests__/timeline-builder.test.ts`

### Acceptance criteria

- [ ] Full cast ritual runs from first coin to final prompt without crash
- [ ] Coins spin with phase offset (3 coins not in sync)
- [ ] Coins land sequentially (120ms stagger), not simultaneously
- [ ] Coins collapse inward to center dot, dot appears on target line row
- [ ] Yang lines draw center-outward as solid bars, 7 frames
- [ ] Yin lines draw center-outward with gap preserved from first frame, 6 frames
- [ ] Lines color-ramp from ash → stone → bone during formation
- [ ] Changing lines pulse with gold (old yang) or moon (old yin) after settling
- [ ] Gutter markers (○ / ×) appear during pulse, not before
- [ ] Trigram gap: visually distinct spacing between lines 3 and 4
- [ ] After line 3: 280ms recognition pause
- [ ] After line 6: ≥1000ms of complete stillness before title
- [ ] Whole-hexagram glow breath after stillness
- [ ] Title reveals as block (not typewriter): Chinese → pinyin → English, each fading in
- [ ] If changing lines: morphs bottom-to-top, each line flips through intermediate frame
- [ ] Morph color: jade/cinnabar → glow → bone (settled = no longer "active")
- [ ] If no changing lines: longer hold + "unchanging" subtitle
- [ ] All 6 changing: single flood pulse + crossfade (not 6 individual markers)
- [ ] Prompt appears after ritual: [enter] reading, [j] journal, [q] quit
- [ ] Prompt keys work correctly
- [ ] `--seed` produces visually identical ritual (same lines, same timing)
- [ ] `--motion reduced`: coins appear directly (no spin), lines draw in one frame, no pulse
- [ ] `--motion brisk`: same structure, faster timing
- [ ] `--motion deep`: same structure, slower timing with longer stillness
- [ ] Keyframe snapshot test: sceneAt(0), sceneAt(2840), sceneAt(5680), sceneAt(final) match expected CellBuffer

### Dependencies

- Depends on [02-core-extraction](02-core-extraction.md) (Cast, Hexagram, GUA data)
- Depends on [05a-terminal-primitives](05a-terminal-primitives.md) (CellBuffer, DiffRenderer, TerminalSession, themes)
- Depends on [05b-animation-engine](05b-animation-engine.md) (Timeline DSL, Scene interface, render loop)

### Estimate

~900 LOC (source) + ~400 LOC (tests)
