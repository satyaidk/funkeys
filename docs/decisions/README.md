# Architecture Decision Records (ADRs)

An **ADR** is a short document that records one important technical decision: the problem, the options considered, what was chosen, and the consequences. Engineering teams at companies like Spotify and AWS use them so that months later, anyone can understand *why* the code is the way it is, not just *what* it does.

Each ADR follows the same template:

- **Status**: Proposed / Accepted / Superseded
- **Context**: the problem and the forces at play
- **Decision**: what we chose
- **Alternatives considered**: what we didn't choose, and why
- **Consequences**: the trade-offs, good and bad

ADRs are **never edited after acceptance** except to change their status. If a decision changes, write a new ADR that supersedes the old one, so the history stays intact.

## Index

| # | Decision | Status |
| --- | --- | --- |
| [0001](./0001-synthesize-sound-instead-of-samples.md) | Synthesize sound with oscillators instead of audio samples | Accepted |
| [0002](./0002-refs-plus-state-for-note-tracking.md) | Track held notes in refs, mirrored to state for rendering | Accepted |
| [0003](./0003-track-physical-keys-with-event-code.md) | Match key releases by physical key (`event.code`) | Accepted |
| [0004](./0004-css-variables-for-responsive-keys.md) | Size keys with CSS variables and `clamp()` | Accepted |
| [0005](./0005-synchronous-audio-init.md) | Initialize audio synchronously instead of awaiting `resume()` | Accepted |

## Writing a new ADR

1. Copy the most recent ADR and give it the next number
2. Fill in each section in plain language (half a page is plenty)
3. Add it to the index above
4. Include it in the same pull request as the code it describes
