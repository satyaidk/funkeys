# Architecture Decision Records (ADRs)

An **ADR** is a short document that records one important technical decision: the problem, the options considered, what was chosen, and the consequences. Engineering teams at companies like Spotify and AWS use them so that months later, anyone can understand *why* the code is the way it is, not just *what* it does.

Each ADR follows the same template:

- **Status**: Proposed / Accepted / Superseded / Amended
- **Context**: the problem and the forces at play
- **Decision**: what we chose
- **Alternatives considered**: what we didn't choose, and why
- **Consequences**: the trade-offs, good and bad

ADRs aren't rewritten after acceptance. When a decision changes, a **new ADR supersedes or amends** the old one, whose status is updated to point at it, so the history of *how the thinking evolved* stays visible. ADR 0003 → 0006 is an example.

## Index

| # | Decision | Status |
| --- | --- | --- |
| [0001](./0001-synthesize-sound-instead-of-samples.md) | Synthesize sound with oscillators instead of audio samples | Accepted |
| [0002](./0002-refs-plus-state-for-note-tracking.md) | Track held notes in refs, mirrored to state for rendering | Accepted, refined by 0008 |
| [0003](./0003-track-physical-keys-with-event-code.md) | Match key releases by physical key (`event.code`) | Superseded by 0006 |
| [0004](./0004-css-variables-for-responsive-keys.md) | Size keys with CSS variables and `clamp()` | Accepted, amended by 0010 |
| [0005](./0005-synchronous-audio-init.md) | Initialize audio synchronously instead of awaiting `resume()` | Accepted |
| [0006](./0006-map-notes-by-physical-key.md) | Map notes by physical key, with layout-aware labels | Accepted |
| [0007](./0007-lookahead-metronome-scheduler.md) | Schedule metronome clicks ahead on the audio clock | Accepted |
| [0008](./0008-pedal-logic-as-a-pure-state-machine.md) | Model pedal logic as a pure state machine | Accepted |
| [0009](./0009-data-driven-voice-recipes.md) | Describe instrument voices as data-driven recipes | Accepted |
| [0010](./0010-two-manual-37-key-layout.md) | A 37-key two-manual layout, scrolling on phones | Accepted |
| [0011](./0011-instrument-as-interface.md) | Design the interface as the instrument itself | Accepted |
| [0012](./0012-loop-riffs-through-the-piano.md) | Loop riffs through the piano, booked on a drift-free timeline | Accepted |

## Writing a new ADR

1. Copy the most recent ADR and give it the next number
2. Fill in each section in plain language (half a page is plenty)
3. Add it to the index above; update the status of any ADR it supersedes
4. Include it in the same pull request as the code it describes
