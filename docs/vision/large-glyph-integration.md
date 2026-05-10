# Large Glyph Integration Design

Where and how pre-rendered braille characters appear in the app.

## Cast Reveal

After the hexagram lines complete + silence + whole-figure glow, the current title reveal shows:

```
            ䷿ 未濟
            Wèi Jì
  Not Yet Fulfilled
     ☲ above ☵
```

### New flow

Replace the small Unicode hex symbol + name with the large braille glyph as the centerpiece.

**Centered layout (no changing lines or narrow terminal):**
```


        ⠀⠀⠀⣠⣤⣤⣤⣤⣄⠀⠀         ← large glyph animates in
        ⠀⠀⠛⠛⣿⣿⠛⠛⠀⠀           (user's chosen animation style)
        ⠀⣤⣤⣤⣿⣿⣤⣤⣤⠀
        ⠀⠀⠀⠀⣿⣿⠀⠀⠀⠀
        ⠀⣿⣿⣿⣿⣿⣿⣿⣿⠀

              未濟
             Wèi Jì
       Not Yet Fulfilled

  [enter] reading  [j] journal  [q] quit
```

The large glyph replaces both the ䷿ Unicode hexagram symbol AND the Chinese name line. Below it: pinyin, English name, then prompt.

The hexagram line diagram stays above (that's the casting ritual output). The glyph appears below the hexagram, above the prompt. The ☲ above ☵ trigram line moves to a subtle dim line.

**Side-by-side layout (changing lines, wide terminal):**
```
   ━━━━━━━━━━━━━━━      ━━━━━━━━━━━━━━━
   ━━━━━━   ━━━━━━      ━━━━━━━━━━━━━━━
   ━━━━━━━━━━━━━━━  ⇒   ━━━━━━   ━━━━━━
   ━━━━━━   ━━━━━━      ━━━━━━   ━━━━━━
   ━━━━━━━━━━━━━━━      ━━━━━━   ━━━━━━
   ━━━━━━   ━━━━━━      ━━━━━━━━━━━━━━━

    [large 未]    →     [large 晉]
     Wèi Jì              Jìn
  Not Yet Fulfilled     Progress
```

Each side gets its own large glyph. The primary glyph renders first (since we show it during the centered phase). When the split happens, the becoming glyph animates on the right.

**Problem**: Two large glyphs side-by-side might not fit. At 64px render size, each braille glyph is ~32 cols wide. Two + gap = ~70 cols. That's tight on 80-col terminals.

**Solution**: Use size 48 or 32 for side-by-side, size 64 for centered single glyph. Or: only show the large glyph for the PRIMARY hexagram in centered phase, then switch to small text when the split happens.

**Recommended**: Show large glyph only in the centered reveal moment (before any split). Once the comparison view appears, use the small Chinese character + pinyin text below each hexagram (current behavior). The large glyph is a moment of revelation, not a persistent label.

## Cast Reveal Timeline (updated)

```
1. Hexagram lines build bottom-to-top (existing)
2. Final stillness — 1100ms silence (existing)
3. Whole-figure glow (existing)
4. ── NEW: Large glyph reveal ──
   a. The large braille character appears BELOW the hexagram
   b. Animated with user's chosen style (noise/dots/radial/sand)
   c. Duration: ~2-3.5s depending on animation
   d. Pinyin fades in below the glyph
   e. English name fades in below that
5. If becoming: split happens (existing), glyph stays as residual
6. Prompt appears (existing)
```

The glyph animation replaces the current instant title reveal. It becomes THE reveal moment.

## Dictionary Detail Page

Current layout:
```
            ䷀ 乾 Qián
            The Creative
   ─────────────────────────
   ━━━━━━━━━━━━━━━  (line diagram)
   ...
```

### New layout

The large glyph is the hero element at the top:

```
        ⠀⠀⠀⣠⣤⣤⣤⣤⣄⠀⠀         ← animates on entry
        ⠀⠀⠛⠛⣿⣿⠛⠛⠀⠀
        ⠀⣤⣤⣤⣿⣿⣤⣤⣤⠀
        ⠀⠀⠀⠀⣿⣿⠀⠀⠀⠀
        ⠀⣿⣿⣿⣿⣿⣿⣿⣿⠀

              乾
             Qián
         The Creative
   ─────────────────────────

   ━━━━━━━━━━━━━━━
   ━━━━━━━━━━━━━━━
   ━━━━━━━━━━━━━━━
                        ☰ heaven
   ━━━━━━━━━━━━━━━
   ━━━━━━━━━━━━━━━
   ━━━━━━━━━━━━━━━
                        ☰ heaven

   ─────────────────────────

   大象傳
   天行健，君子以自強不息
   ...
```

The large glyph animates once on entry, then stays static. Below it: the small Chinese char, pinyin, English name. Then the hexagram diagram, commentaries, derived links.

**On re-entry** (navigating back then forward, or pressing a derived link): the glyph animates again. Each visit is a fresh encounter.

## Home Menu

Current:
```
              ☯
             易經
           I Ching

        [c] Daily Cast
        ...

   Today: ䷛ 大過 (Dà Guò)
```

### Possible enhancement

Show the large glyph of today's cast in the background, very dim (using the dimmed theme color), behind the menu. A ghostly presence of today's hexagram.

Or: simpler — show the small glyph in the "Today:" line as-is. The home menu is a menu, not a display. Keep it clean.

**Recommended**: No large glyph on home menu. Keep it minimal.

## Settings Preview

Already done — the preview area in settings shows the large glyph with the selected animation. No changes needed.

## Implementation Summary

| Screen | Large glyph? | When | Size |
|--------|-------------|------|------|
| Home menu | No | — | — |
| Cast reveal (centered) | Yes | After hexagram + stillness + glow | User's configured size |
| Cast reveal (split) | No | Large glyph only in centered phase | — |
| Dictionary detail | Yes | On entry, as hero header | User's configured size |
| Journal | No | Too many entries, would be noisy | — |
| Settings | Yes (preview) | Already done | User's configured size |

## Multi-Character Names

Names like 小畜, 大有, 噬嗑, 未濟 have 2 characters. Render BOTH large, side by side:

```
  ⠀⠀⣠⣤⣤⣤⣤⣄⠀⠀ ⠀⠀⢀⣀⣀⡀⠀⠀
  ⠀⠀⠛⠛⣿⣿⠛⠛⠀⠀ ⠀⠀⣿⣰⣒⣇⠀⠀
  ⠀⣤⣤⣤⣿⣿⣤⣤⣤⠀ ⠀⠀⡇⡖⢲⢸⠀⠀
  ⠀⠀⠀⠀⣿⣿⠀⠀⠀⠀ ⠀⢀⡼⢜⣃⣚⡀⠀
  ⠀⣿⣿⣿⣿⣿⣿⣿⣿⠀ ⠀⠀⠀⠀⠀⠀⠀⠀

              未 濟
```

Both characters animate together (same animation, same timing). The generator already stores per-character data — just render two glyphs adjacent.

Need to update `scripts/generate-glyphs.ts` to ensure ALL characters used in hexagram names are rendered (not just the first character of multi-char names).

## Cast Reveal — Full Interaction Flow

The cast result is not a static screen — it's an interactive exploration space.

### Phase 1: Casting Ritual
```
coins → lines build → trigram gap → final stillness → glow
```
(Existing, no change)

### Phase 2: Primary Reveal
```
   ━━━━━━━━━━━━━━━
   ━━━━━━   ━━━━━━
   ━━━━━━━━━━━━━━━

   ━━━━━━   ━━━━━━
   ━━━━━━━━━━━━━━━  ○
   ━━━━━━   ━━━━━━  ×

  [large 未濟 animating...]

         未 濟
        Wèi Jì
    Not Yet Fulfilled
      ☲ above ☵

  大象傳: 火在水上，未濟；
  君子以慎辨物居方
```

Large glyph animates below hexagram. Once settled → static. Reading details appear below: pinyin, English name, trigram info, commentary.

### Phase 3: Changing Lines Morph
If changing lines exist:
- Changing lines pulse
- Lines morph in-place (or split to side-by-side if wide)
- Primary hexagram moves left, becoming appears right

### Phase 4: Becoming Reveal
```
   [primary hex]    ⇒    [becoming hex]

  [large 未濟 static]    [large 歸妹 animating...]

        未 濟                 歸 妹
       Wèi Jì               Guī Mèi
  Not Yet Fulfilled     The Marrying Maiden

  大象傳: 澤上有雷，歸妹；
  君子以永終知敝
```

The becoming glyph animates on the right. Its reading details replace the primary's below.

### Phase 5: Interactive Exploration
Now both hexagrams are visible. The user can switch focus:

```
← → : switch highlight between primary (left) and becoming (right)
```

**Left highlighted** (default after morph):
- Left hexagram lines brighter, right dimmer
- Large glyph shows primary (re-animates briefly or pulses)
- Reading details below show primary's commentary

**Right highlighted**:
- Right hexagram lines brighter, left dimmer
- Large glyph shows becoming
- Reading details below show becoming's commentary

```
   [primary dim]    ⇒    [becoming BRIGHT]

             [large 歸妹]

              歸 妹
             Guī Mèi
        The Marrying Maiden
           ☳ above ☱

  大象傳: 澤上有雷，歸妹；
  君子以永終知敝
```

### Controls
```
← →    switch between primary / becoming
↑ ↓    scroll reading details (if long)
enter  open full detail in dictionary
d      open dictionary
j      open journal
q      quit
```

This turns the post-cast screen into a mini-explorer. You cast, you see the result, you can flip between the two hexagrams to read their commentaries, and you can drill into the dictionary for the full reference.

### Single hexagram (no changing lines)
No left/right switching. Just the primary with its glyph + reading. ↑↓ scrolls. enter opens dictionary detail.

## Layout Math

Large glyph at size 64 = ~32 braille cols wide, ~16 rows tall.
Two chars side by side (未濟) = ~66 cols.
On 80-col terminal: 66 + margins = tight but fits.

For the side-by-side hexagram comparison view with TWO large glyph pairs:
- Primary glyph pair (~66 cols) + becoming glyph pair (~66 cols) = doesn't fit
- Solution: show only ONE large glyph pair at a time (the highlighted hexagram)
- The glyph area is shared — left/right arrow swaps which glyph is shown

```
   [primary hex]    ⇒    [becoming hex]

        ← [large glyph of highlighted hexagram] →

              名 前
             Pinyin
          English Name
   ───────────────────────
   Commentary of highlighted hexagram...
```

The glyph + reading section is a SINGLE area that shows whichever hexagram is highlighted. The hexagram line diagrams stay side-by-side at top. Arrows switch which one the detail area describes.
