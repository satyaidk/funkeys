# ADR 0009: Describe instrument voices as data-driven recipes

- **Status:** Accepted (extends [ADR 0001](./0001-synthesize-sound-instead-of-samples.md))
- **Area:** Audio (`lib/audio/voices.ts`, `lib/audio/synth-voice.ts`)

## Context

The app grew from one piano sound to **eight voices** with very different techniques: additive partials, FM bells, vibrato, tremolo, noise transients, natural decay. Each could be its own function (`playOrgan()`, `playStrings()`…), but that duplicates the shared plumbing (envelope, filter, panning, release, cleanup) eight times.

## Decision

- A single **`VoiceDefinition`** type describes any voice: partials, inharmonicity, envelope, hold decay, filter, optional FM / LFO / attack noise, and a loudness trim
- **One builder**, `createVoice()`, turns any recipe into Web Audio nodes
- `VOICES` is an array of eight recipe objects; the UI lists them automatically

## Alternatives considered

| Option | Why not |
| --- | --- |
| One function per instrument | Duplicated envelope, filter, release and cleanup code |
| Class per voice with inheritance | More ceremony than data; behaviors combine (FM + tremolo) better as options than as subclasses |
| Sample libraries | See ADR 0001 (download size, licensing) |

## Consequences

- ✅ Adding an instrument means adding an object, with no engine changes
- ✅ Every recipe is validated by the same parameterized test (`it.each(VOICES)`)
- ✅ Sound design lives in one readable file, which makes it easy to tweak and to explain
- ⚠️ A new technique (e.g. granular synthesis) needs a new optional field and builder support
