# ADR 0013: Play songs and transcriptions on the audio clock

- **Status:** Accepted (supersedes [ADR 0012](./0012-loop-riffs-through-the-piano.md))
- **Area:** Playback (`lib/audio/sequence-player.ts`, `audio-engine.ts`, `hooks/useSequencePlayer.ts`)

## Context

ADR 0012 looped short riffs by pressing the piano's keys with `setTimeout`. That was the right call for two-bar loops, and it listed its own limits: notes a few milliseconds late when the page is busy, a loop that restarts after a background tab.

Two new features outgrew it:

1. **Audio to Piano** plays transcriptions up to ten minutes long, with chords of a dozen notes and long silences that must be kept exactly. It needs **pause, resume, seek, speed and a progress bar**.
2. **The Notes library** plays full pieces with both hands, also with a progress bar and seeking.

One `setTimeout` per note can't seek or pause cleanly (every timer must be found and moved), drifts with main-thread work, and books thousands of timers for a long piece.

## Decision

- **One transport, `SequencePlayer`, on the audio clock.** It uses the metronome's lookahead technique ([ADR 0007](./0007-lookahead-metronome-scheduler.md)): a timer wakes every 25 ms and books every note due in the next 200 ms at its exact audio-clock time. Timer jitter can't move a note.
- **One anchor maps song time to audio time:** `songTime(t) = anchorSong + (t − anchorAudio) × rate`. Seek, resume and speed changes only move the anchor. Looping counts song time on past the end (pass 2 starts at `duration`).
- **The engine books whole notes:** `AudioEngine.scheduleNote(frequency, options, start, end)` creates the voice at `start`, books its release at `end`, and returns a handle. `SynthVoice.cancel()` cuts a note even when its release is already booked (pause, stop, seek).
- **Same sound as your fingers:** every booked note goes through `voiceNote()`, the function `usePiano.noteOn` uses, so voice, layer/split and tuning apply.
- **Keys light from what is sounding:** the player keeps its bookings; an animation-frame loop asks which are between their start and end on the audio clock and lights those keys. React state changes only when the set of keys changes.
- **Duration is the piece's, not the last note's:** the player runs to `max(duration, last note end)`, so a recording's silent ending plays out.
- **Songs play at their written pitch.** When playback starts from the top, the keyboard shifts (if needed) to the octave showing the most of the piece. Nothing is transposed to fit.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Keep `setTimeout` per note (ADR 0012) | No clean seek or pause; thousands of timers for a long piece; late notes when the page is busy |
| Book every note up front on the audio clock | A five-minute piece would create every voice at once (thousands of oscillators); cancelling on seek means walking all of them |
| Tone.js `Transport` | A large dependency, and it hides exactly the concept this project teaches |
| Keep riffs on the old looper, transcriptions on the new player | Two schedulers to maintain, two behaviours to explain |

## Consequences

- ✅ Sample-accurate timing over any length; tested with a fake clock, including a five-minute timeline and a one-minute silence (28 `SequencePlayer` tests)
- ✅ Play, pause, resume, stop, seek, speed (25–200%) and loop for songs and transcriptions alike
- ✅ Background tabs: while hidden, the player books 1.5 s ahead (timers slow to about once a second), so playback continues instead of restarting
- ⚠️ Playback no longer goes through `noteOn`: **the recorder doesn't capture a playing song**, and **the sustain pedal doesn't hold its notes** (ADR 0012 had both). A transcription already contains its own note lengths, so the pedal isn't needed there
- ⚠️ Seeking into the middle of a long note doesn't restart it (as in most MIDI players); notes play from the first one starting at or after the new position
- ⚠️ Songs used to follow the octave shift (a riff moved with the keyboard); they now play at their written pitch and the keyboard moves to them instead
