# Yarrow Ritual Vision

How the yarrow stalk casting method should work — its math, its terminal
vocabulary, its pacing, and how it joins the existing cast flow.

This is a design vision note, not an implementation task list. It is the answer
to the deferral in [Entropy Sources Vision](entropy-sources-vision.md), which
held that "yarrow should return later as a guided ritual, not as a quick hidden
algorithmic toggle."

## Premise

Yarrow is not a reskin of the coin cast. Two things make it a distinct method,
and both must survive into the implementation:

1. **It has a different probability distribution.** Coins are symmetric
   (1/8 : 3/8 : 3/8 : 1/8 over line values 6/7/8/9). Yarrow is asymmetric
   (1/16 : 5/16 : 7/16 : 3/16). Old yin becomes rare; young yin dominates. This
   asymmetry is the whole reason practitioners distinguish the methods. A
   "yarrow mode" that does not reproduce it is cosmetic and misleading.

2. **It is subtractive, not additive.** Coins are impact: throw, land, sum, then
   draw a line. Yarrow is winnowing: a mass of potential is divided, counted
   away in fours, and what *remains* is the answer. The cast and the line are
   not separate acts — the surviving material *becomes* the line.

The first principle the animation must protect: **an irreversible form emerging
from attended uncertainty.** The test for whether the design works — after
watching the default presentation, a user can say "I saw *how* the yarrow
method produced this," not merely "I waited longer than coins."

## Decided: Faithful Simulation

The casting math is a faithful 49-stalk simulation. Per line there are three
rounds; the line value is derived from the stalks remaining after the third
round.

### Algorithm

Per round, starting from a pile of `N` stalks:

1. Pick a random split point `k` in `[1, N-1]` via the existing `RandomSource`.
   Left heap = `k`, right heap = `N - k`.
2. Take one stalk from the right heap and set it aside.
3. Count the left heap by fours; the remainder is `1-4` (a remainder of `0`
   counts as `4`).
4. Count the right heap (after the removed stalk) by fours; same remainder rule.
5. `setAside = 1 + leftRemainder + rightRemainder`.
   - Round 1 (starting from 49): `setAside` is always **5 or 9**.
   - Rounds 2 and 3: `setAside` is always **4 or 8**.
6. `remaining = N - setAside`, carried into the next round.

After three rounds `remaining` is one of `{24, 28, 32, 36}`; divided by 4 it
gives the line value `{6, 7, 8, 9}`.

### Distribution must be validated

The textbook yarrow distribution (1/16 : 5/16 : 7/16 : 3/16) depends on the
probability model behind the split. A uniformly random integer `k` is the
standard computational model and should produce it closely — but this is an
assumption, not a guarantee.

**Requirement:** a core test samples many casts and asserts the line-value
distribution converges to the target within tolerance. If it deviates, the fix
belongs in the split-point model, not in the animation.

### The transcript is the storyboard

The simulation computes the *entire* result up front — every round's `k`,
`leftRemainder`, `rightRemainder`, `setAside`, and `remaining` — and emits it as
an immutable **ritual transcript**. The animation is a pure replay of that
transcript.

```ts
interface YarrowRound {
  startCount: number;       // 49 → 44|40 → ...
  splitAt: number;          // k — the random draw, made visible on screen
  leftRemainder: number;    // 1-4
  rightRemainder: number;   // 1-4
  setAside: number;         // round 1: 5|9   rounds 2-3: 4|8
  remaining: number;
}
interface YarrowLineResult {
  rounds: [YarrowRound, YarrowRound, YarrowRound];
  line: Line;               // remaining / 4 → 6|7|8|9
}
```

This gives deterministic replay, testability, and a fast-forward path for free.
The emotional caveat: the transcript is locked at the *moment the cast begins*.
The animation reveals it gradually. The app must never communicate "the answer
was already known" — it communicates "the answer was committed at the threshold,
and you are now witnessing its emergence."

## The Terminal Vocabulary

Yarrow is modelled, not literally mimicked. Coins found their form in the round
character; large glyphs found theirs in braille. Yarrow's form is **the braille
dot as a unit of counted quantity**.

Braille is not decoration here. It is the only primitive the terminal has for
*counted quantity at sub-cell resolution* — it can hold 49 of something in a
handful of cells and deplete it one unit at a time. A stalk-per-glyph approach
cannot winnow gracefully; a braille field thins.

And its geometry already *is* the ritual's arithmetic:

```
a stalk   = one dot
a "four"  = one dot-column          ⡇   (4 dots)
a cell    = two fours               ⣿  =  ⡇ + ⢸
```

A braille cell is the count-of-four, twice. Counting by fours is never drawn as
a special effect — it is a dot-column being lit or extinguished. The modular
arithmetic of the cast and the anatomy of the glyph are the same shape.

Braille is also already in the app's vocabulary (large-glyph rendering), so this
is a through-line, not a new dialect. And it is diff-renderer friendly:
extinguishing a column is a localized cell mutation, not a sprite translating
across the grid.

## The Round, Beat by Beat

The hexagram builds in the upper band; the field works below it, so the
remainder can rise *into* the line. Each beat is a `call` (state change) plus a
`tween` (motion); a round is a `seq()`; the two heaps count in `par()`.

| Beat | What happens | Visual |
|---|---|---|
| `gather` | The field rests, undifferentiated. | A solid braille strand. No fours visible — structure is imposed by the ritual, not a property of the mass. |
| `divide` | The strand cleaves at `splitAt`. | A gap opens. Its *position* is the random draw — yarrow's equivalent of the coin's spin-and-land. Chance is a location, not a tumble. |
| `takeOne` | One dot lifts from the right heap and parks. | A single braille dot held aside. The one beat that stays slow regardless of preset. |
| `count` | Fours extinguish in rhythm, column by column. | Spent dots ramp down to `tertiary`; the surviving remainder ramps up to `accent`. The mass resolves into its fours as they leave. |
| `tally` | The taken one and both remainders collect. | An accreting clump in a side tray. Consequence shown in the material — never a number in a panel. |
| `carry` | Survivors re-cohere for the next round. | A tighter strand. The field visibly shrank — this shrink is the anti-monotony engine. |

After the third round, one beat unique to yarrow:

| Beat | What happens | Visual |
|---|---|---|
| `fuse` | The surviving field becomes the line. | The remaining dots stream upward and condense into the hexagram line, which joins the figure from the bottom up. |

`fuse` is the move coins cannot make. Coins *produce* a line; the yarrow field
*turns into* one — same ink, two scales. The hexagram is visibly made of the
substance that was winnowed.

### Storyboard — one round

Line 3, round 1. Two lines already stand above. The simulation picked
`splitAt = 20`; `leftRemainder = 4`, `rightRemainder = 4`, `setAside = 9`,
`remaining = 40`.

```
1 · GATHER
  · · · · · · · · · · · · ·        line 3  (empty slot, faint)
  ━━━━━━━━━━━━━━━━━━━━━━━━━        line 2
  ━━━━━━━━━     ━━━━━━━━━━━        line 1
           ⣿⣿⣿⣿⣿⣿⠁                 forty-nine

2 · DIVIDE                          (the gap position is the random draw)
           ⣿⣿⡇      ⣿⣿⣿⣿⠅
           └ 20 ┘    └  29  ┘

3 · TAKE ONE
                ⠁                   ← set between the fingers
           ⣿⣿⡇      ⣿⣿⣿⣿⠄
           └ 20 ┘    └  28  ┘

4 · COUNT                           (· = spent/dim, ⡇ = remainder/accent)
  spent → · · · ·          · · · · · ·
  rem   →     ⡇                    ⡇

5 · TALLY
  tray   ⣿⠁                         nine — set aside
  field  ⣿⣿⣿⣿⣿                       forty carried

6 · CARRY
           ⣿⣿⣿⣿⣿                    forty  →  round 2
```

After round 3 (say `remaining = 28`, `28 / 4 = 7`, young yang):

```
FUSE
  ━━━━━━━━━━━━━━━━━━━━━━━━━        line 3  ← formed, glowing
  ━━━━━━━━━━━━━━━━━━━━━━━━━        line 2
  ━━━━━━━━━     ━━━━━━━━━━━        line 1
                                   (field empty — it became the line)
```

Color does the work a ledger would otherwise do: `primary` = live potential,
`tertiary` = spent, `accent` = the remainder that matters.

## Pacing

Eighteen rounds fully animated is four to six minutes — too long for a daily
default. But the fix is not to hide the ritual. The constraint:

> No non-`reduced` presentation may hide the counting mechanism. If the default
> user never sees fours being counted away, the asymmetric ritual they are told
> they are performing is invisible to them, and the method collapses back into a
> hidden toggle.

### Two axes, not one

The mistake to avoid is overloading a single `MotionPreset` enum to control
three different things: motion speed, semantic detail, and accessibility. They
are separated:

- **`MotionPreset`** (existing: `deep` / `default` / `brisk` / `reduced`) —
  controls tweening, easing, movement, and delay. Pure motion.
- **`RitualDetail`** (new) — controls how much of the count is animated:
  - `expanded` — every group of four peels away individually.
  - `summarized` — groups of four are visible but swept as batches; the split,
    the remainders, and the removed tally are always shown.
  - `stepped` — static before/after states per beat (split → remainders →
    tally → carry); no peeling motion, but the *concept* of counting is never
    skipped.

Even if these stay a single public setting, treat them as separate axes
internally. `reduced` means reduced *motion* — a calm field changing state — not
reduced *meaning*. `brisk` means the method shown in compressed form, not a
random-result machine.

### Teach once, then compress

The first yarrow cast in a session animates one round (or one full line) in
`expanded` detail, then transitions into `summarized`. Later casts default to
`summarized`. The user learns the rhythm once; repetition after that is earned,
not endured.

### Pace control

A ritual benefits from agency. The user can press a key to advance a beat, hold
to accelerate, or choose `auto`. Agency handles daily-use impatience better than
amputating semantic content does.

## Joining the Cast Flow

The yarrow scene owns only the 18-round ritual and the six line draws. After
`fuse` completes the figure, it hands the finished hexagram to the existing
post-cast reveal (glow, transformation, glyph, exploration).

But the reveal was tuned for coins — impact and snap. Yarrow's arc is
accumulation and patience. Handing it off *unchanged* risks making the whole
ritual feel like a long input animation feeding the old result scene. So:

> Add one yarrow-specific bridge beat. The completed figure holds for a breath
> as *the thing the winnowing produced* before the shared reveal phase begins.
> The payoff inherits the ritual instead of resetting to it.

## Architecture

The existing structure is already pluggable; no refactor is required.

| Location | Responsibility |
|---|---|
| `packages/core/src/casting/yarrow.ts` | Faithful 49-stalk sim; emits `YarrowLineResult[]`. Distribution test lives beside it. |
| `packages/terminal/src/animation/yarrow-presets.ts` | `YarrowTiming` interface; `RitualDetail` axis; presets. |
| `packages/terminal/src/scenes/yarrow/model.ts` | `YarrowModel` — holds the transcript plus live animation state (active line/round/beat, heap counts, tray, caption). |
| `packages/terminal/src/scenes/yarrow/yarrow-timeline.ts` | `buildYarrowTimeline()` — `seq` of 6 line rituals, each a `seq` of 3 rounds, each the beat `seq`. |
| `packages/terminal/src/scenes/yarrow/field-renderer.ts` | Draws the braille field, the gap, the tray, the rising fuse. |
| `packages/terminal/src/scenes/yarrow/yarrow-scene.ts` | Owns the ritual; hands the `Cast` to `CastScene` with `{ skipLineDrawing: true }`. |

Reading-flow and config integration: add `{ type: "yarrow" }` to
`ReadingSource`; extend the cast-method setting to include `yarrow`; wire the
settings scene and the main menu.

## Manual Modes

The cast can be observed (auto) or performed (manual). Two manual variants
share the codebase but answer different questions about what the operator does.

### Full Manual — spatial authorship (shipped)

Eighteen sweep-and-snap gestures per cast: one per round (3 rounds × 6 lines).

A 4-stalk-wide aperture sweeps across the current pile (49, then ~40, then
~32, etc.). The operator taps Space to snap the aperture at a chosen
position; the system picks a uniform-random k from inside the 4-stalk window
and uses it as that round's split. The 4-stalk width preserves the mod-4
distribution exactly — every consecutive 4-stalk window has one k where
`k % 4 === 0` and three where it doesn't, matching the textbook 1:3 setAside
ratio (independently of pile size).

The operator authors **where** to cut at every round, without authoring the
modulo outcome. The substance's natural imprecision (a real diviner's grab
isn't precision-aimed either) is reified as the 4-stalk aperture.

### Line-Gate — temporal commitment (future)

Six gestures per cast: one per line. Not a compressed 18 — a different
analog entirely.

No cursor, no sweep, no aiming. The pile sits at its starting count and
*waits*. The operator taps Space when ready. The tap moment salts the RNG
seed for the upcoming line; rounds 1–3 + fuse play automatically with that
salted seed. The line lands and the pile re-gathers, waiting for the next
gate.

Each between-line tap is a **hinge** — it receives the line that just landed
AND opens the next one. After line 6, a final receive tap hands the cast to
the reveal.

The operator owns the **temporal threshold** of each line: when does this
line begin, when do I accept it, how long do I dwell. Spatial authorship
belongs to full-manual; observation belongs to auto; line-gate occupies the
unique space of presence-without-authorship.

> Phrase it as: *"Your timing seals the line; the yarrow rounds unfold from
> there."* Not *"your tap chooses the result."*

#### Visual primitives the mode needs

A naked tap is too thin. The UI must give the moment a threshold to cross:

1. **Pile breathes while waiting.** Slow color pulse (~2s cycle) between
   primary and secondary. The pile is alive and waiting — distinct from
   the static gather pose in auto mode.
2. **Tap absorbs visibly.** Brief accent flash on the pile (~150ms) at the
   moment of tap, then the divide begins. The operator's touch passed
   through the substance.
3. **Just-landed line glows.** After fuse, the new line holds in accent
   color for ~800ms before settling to its final color. The glow IS the
   "received it" moment.
4. **Optional pulse marker.** A faint `·` somewhere subtle, pulsing in sync
   with the breath. Removes ambiguity that the system is waiting.

Without these cues, the gate collapses into a Continue button. The mode is
only worth shipping with the visual primitives intact.

#### Design test

After one line, ask the operator: "What did Space do?"

- ✅ "It let the next line begin." / "I received the line." / "I sealed the
  next one." / "I paused until it felt ready."
- ❌ "It advanced the animation." / "It picked the seed." / "It skipped to
  the next part."

Behavioral signal: operators should naturally dwell different durations
between lines. If everyone mashes Space immediately, the mode collapsed
into step-through auto and should be dropped.

#### Why three modes (not two)

| Mode | What the operator owns | Sentence |
|---|---|---|
| Auto | Observation | "I am present at the cast" |
| Line-Gate | Temporal threshold of each line | "I govern when the ritual proceeds" |
| Full Manual | Spatial cut at every round | "I author every cut" |

Three positions on the agency spectrum. Each owns a unique sentence; if
line-gate can't own its sentence in practice, drop it back to two.

## Open Questions

- **Provenance.** Should the ritual transcript (every round's intermediate
  values) be persisted to the journal, or is method-name provenance enough?
  This connects to the `rng` provenance block sketched in the entropy vision.
- **The cast-method setting.** It is becoming a *method* enum (coins / yarrow),
  which is distinct from a *pacing* choice. Worth deciding whether method and
  pacing are one setting or two when yarrow lands.
- **Narrow terminals.** The braille field is compact, but very narrow widths
  still need a defined fallback — a shorter strand, or a stacked field.

## Non-Goals

- Literal stalk glyphs or fake stalk physics. The model is faithful; the
  representation is the braille field.
- A numeric side ledger as the primary representation. Consequence is shown in
  the material and carried by color.
- Hiding the counting mechanism behind a "fast" preset.
