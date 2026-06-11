# Entropy Sources Vision

How the app should think about randomness, intention, locality, and numinosity.

This is a vision note, not an implementation plan.

## Premise

The goal is not only to produce statistically good random bits. The goal is to
support a cast that feels numinous: subjectively charged, locally grounded, and
bound to the moment of consultation.

That claim is experiential, not scientific. The app should avoid pretending it
can prove "manifestibility" or metaphysical efficacy. It can, however, be honest
about provenance: where the entropy came from, what local participation shaped
it, and whether the cast is repeatable.

## Current State

The current production source is `CryptoRandomSource`, which calls
`crypto.randomBytes`.

That is already local, private, and physically grounded through the operating
system entropy pool and cryptographic random generator. It is strong engineering.
It is also opaque to the user: the app cannot tell a richer ritual story than
"local machine entropy was used."

Seeded mode exists for deterministic replay and tests. It should remain clearly
separate from live casting semantics.

## Vocabulary

| Term | Meaning |
|---|---|
| Entropy | Unpredictable input used to produce cast bytes. |
| Provenance | The honest source story for the entropy. |
| Binding | Mixing intention/session context into entropy without replacing chance. |
| Locality | How close the source is to the user's body, machine, room, and moment. |
| Embodiment | Whether the user's action or hesitation participates in the cast. |
| Numinosity | The subjective felt charge of the ritual. |

## Source Taxonomy

### `crypto`

Default mode.

Uses local cryptographic randomness only.

Contract:

- Private.
- Fast.
- Reliable.
- Not deterministic.
- No network.
- No special ritual claim beyond local machine entropy.

### `bound`

Near-term preferred upgrade.

Status: implemented 2026-06-10 as `BoundRandomSource` (core), behind the
`entropy` config key with `crypto` still the default. The seed is a SHA-256
of fresh crypto bytes, the intention text, an ISO timestamp, and a per-process
nonce (each field length-prefixed); cast bytes expand from it via a
hash-counter DRBG. Provenance is recorded as an `rng` block on journal and
cache entries and in `cast --json`; plain output carries the one quiet label
below only when binding actually happened. `--seed` remains its own path.

Uses local cryptographic randomness, then binds the cast to intention and session
context.

Example conceptual shape:

```text
crypto bytes
+ intention text, if present
+ timestamp/session nonce
-> cryptographic hash/mixer
-> cast bytes
```

Contract:

- Chance remains primary.
- Intention participates as salt/context.
- Same intention does not force the same result.
- No network.
- Still private and reliable.

This is the best V0 direction for "the question participates in the cast" without
turning the oracle into a deterministic hash of the question.

### `embodied`

Future local ritual mode.

Uses `bound`, plus local interaction signals such as keypress timing, pauses,
terminal event jitter, or other explicit user-session measurements.

Conceptual shape:

```text
crypto bytes
+ intention text
+ timestamp/session nonce
+ timing samples from the casting ritual
-> cryptographic hash/mixer
-> cast bytes
```

Contract:

- Locality is stronger than `crypto` or `bound`.
- The user's hesitation and attention participate.
- The app should show this as ritual participation, not as superior science.
- Sensor/timing data must stay local by default.

This mode is probably more aligned with the project's numinous goal than a remote
quantum API, because the uncertainty is adjacent to the user.

### `quantum-remote`

Optional future mode.

Fetches quantum-origin random bytes from a remote provider, such as ANU Quantum
Numbers or a similar QRNG service, then mixes them with local crypto and any
intention binding.

Contract:

- Strong physical provenance: remote lab quantum measurement.
- Weak locality: the source is elsewhere.
- Requires network and provider availability.
- May require an API key or paid usage beyond a free tier.
- Must never be the default.
- Must fail gracefully back to local entropy only with explicit user-facing
  provenance.

The honest claim is "remote quantum-origin entropy participated in this cast,"
not "this cast is more metaphysically effective."

Implementation note for later: fetch a block once per cast, not once per coin,
line, or virtual stalk.

### `seed`

Deterministic replay mode.

Contract:

- Same seed produces same cast.
- Useful for tests, demos, bug reports, and shared examples.
- Not a live divination source.

Intention-only seeding should not be used for normal casting. That would make:

```text
same intention -> same cast
```

which is a symbolic hash oracle, not chance. It may be a future experimental
mode, but it should not be confused with live casting.

## Non-Goals For Now

### Yarrow

Do not add yarrow yet.

Real yarrow has high ritual embodiment, but supporting it well has animation,
instruction, pacing, and data-entry implications. Simulated yarrow also changes
line probabilities and deserves its own interaction design.

Yarrow should return later as a guided ritual, not as a quick hidden algorithmic
toggle.

### Local Quantum

Do not claim local quantum randomness without local QRNG hardware.

A local "quantum simulator" can simulate quantum-looking statistics, but its
measurement still bottoms out in ordinary pseudorandom or cryptographic random
bytes. That is quantum-inspired presentation, not quantum-origin entropy.

### Metaphysical Proof

Do not claim any source has higher manifesting power.

Use language like:

- "physical provenance"
- "local participation"
- "intention binding"
- "ritual salience"
- "felt numinosity"

Avoid language like:

- "proves manifestation"
- "more spiritually effective"
- "guaranteed synchronicity"
- "scientifically channels intention"

## Recommended Product Path

### V0

Keep `crypto` as default.

Add `bound` if and when entropy work begins:

- Mix intention as salt, never as sole seed.
- Include a session nonce or timestamp.
- Use a cryptographic hash/mixer.
- Preserve deterministic `--seed` as its own explicit path.
- Record provenance in JSON output and journal entries.

### V0.1+

Add `embodied` after the casting animation has a natural collection window:

- Capture timing during the existing ritual, not through a separate form.
- Keep raw timing samples out of the journal unless explicitly needed.
- Store only provenance summary and final mixed-source label.

### Future

Add `quantum-remote` only as opt-in:

- Requires provider abstraction.
- Requires timeout and fallback.
- Requires clear provider/API-key configuration.
- Should mix remote quantum bytes with local crypto, not replace local entropy.

## Provenance Labels

Every cast should eventually be able to describe its entropy plainly:

```json
{
  "rng": {
    "source": "bound",
    "local": true,
    "network": false,
    "deterministic": false,
    "intentionBound": true,
    "embodied": false,
    "provider": null
  }
}
```

For user-facing text:

```text
Entropy: local machine entropy, bound to the intention and moment.
```

For quantum:

```text
Entropy: remote quantum-origin bytes mixed with local machine entropy and intention.
```

For seed:

```text
Entropy: deterministic replay from seed 42.
```

## Core Stance

The strongest path for this app is not "most exotic randomness."

It is:

```text
local entropy
+ intention binding
+ embodied timing when available
+ honest provenance
```

Remote quantum randomness can be beautiful as an optional mode, but the core
ritual should stay local, private, reliable, and bound to the user's actual
moment of consultation.
