# ADR 0012: Loop riffs through the piano, booked on a drift-free timeline

- **Status:** Accepted
- **Area:** Notes page (`lib/music/sequence.ts`, `riffs.ts`, `looper.ts`, `hooks/useLooper.ts`)

## Context

The Notes page loops famous riffs (Tokyo Drift, Lean On, …) until you press Stop. A loop has three jobs:

1. **Teach.** The keys should light up as the riff plays, so you can see which ones to press and play along
2. **Sound like the instrument.** The current voice, layer/split, pedals, touch and tuning should apply
3. **Stay in time** however long it runs

The project already had two timing models. The metronome books clicks on the **audio clock** ([ADR 0007](./0007-lookahead-metronome-scheduler.md)): sample-accurate, but the clicks go straight to the engine. The recorder drives the piano through `noteOn`/`noteOff` with **one `setTimeout` per event**: keys light up, but it plays one take with a known end.

## Decision

- **Play through the piano.** The looper calls the same `noteOn` / `noteOff` as your fingers and recorder playback, so jobs 1 and 2 come for free (one code path for starting a note).
- **Book on a fixed timeline.** `Looper` books each note with `setTimeout` at an *absolute* time, `passStart + note.start × msPerBeat`, and books the next pass 100 ms before the current one ends, starting at `passStart + loop length`. A late timer delays only its own note; nothing adds up, so the loop never drifts.
- **Gate at 90%.** Each note sounds for 90% of its written length, so a repeated note strikes again instead of blurring into one.
- **Recover, don't catch up.** If timers fall more than 250 ms behind (a background tab), the pass restarts from now instead of firing every missed note at once.
- **Melodies as text.** Riffs are written like `A#4/8. B4/8. D#5/8` and parsed by `parseSequence`; tests check every riff parses, fits the keyboard and fills whole bars.
- The looper is a plain class in `lib/` (like `MetronomeScheduler`), wrapped by the `useLooper` hook.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Book notes on the audio clock, like the metronome | Sample-accurate, but needs a second route into the engine that skips `usePiano`: no key lighting, no pedal rules, nothing for the recorder to capture. A possible upgrade: book the audio ahead and delay only the key lighting, as the metronome does for its beat lights |
| Chain timers ("next note x ms after this one") | Every timer's lateness adds to all the notes after it: the loop drifts further behind each pass |
| Book everything up front, like the recorder | A loop has no end. Booking one pass at a time also keeps changing riff or speed simple: stop, then book again |
| A library (Tone.js `Transport`) | A dependency, and it hides the concept this project is here to teach |

## Consequences

- ✅ Keys light up and every instrument setting applies; recording while a loop plays captures it
- ✅ No drift over any number of passes; fully testable with fake timers (8 `Looper` tests, 8 `useLooper` tests)
- ✅ Adding a song is adding a line of text to `riffs.ts`
- ⚠️ Individual notes can still be a few milliseconds late when the main thread is busy (timers, not the audio clock)
- ⚠️ Browsers throttle timers in background tabs; the loop restarts cleanly when you come back rather than staying perfectly in time
- ⚠️ The loop and your fingers share the keys: playing a key the loop is holding can end both notes, as with recorder playback
