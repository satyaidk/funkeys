# Part 8: Playback, songs, transcription and touch

The features added on top of the instrument: one audio-clock transport for songs and transcriptions, the Notes library, Audio to Piano, and touch input on phones. Read parts 1–7 first; this part assumes the engine, `usePiano` and the melody format.

```
                    ┌──────────── Notes library (songs.ts, song-library.ts)
                    │                     │ parts (beats) → notes (seconds)
 recording ─► transcriber ─► worker ──► notes ─► editor (undo) ─┐
 (WAV, MP3)    (lib/transcription)      (PianoNoteEvent[])      ▼
                                                    SequencePlayer ─► voiceNote ─► AudioEngine.scheduleNote
                                                         │
                                                         └─► soundingNotes() ─► keys light up
```

---

## `types/index.ts`: `PianoNoteEvent`

One shape for every timeline in the app: `{ id, midi, startTime, endTime, velocity }`, **in seconds**. Songs are written in beats (because sheet music is) and converted once; recordings arrive in seconds. Notes may overlap and start together, and pitch is never moved to fit the keyboard.

---

## `lib/music/note-events.ts`

### Purpose
Conversions, queries, validation and edits for `PianoNoteEvent`.

### Code explained
- `beatsToSeconds(beats, bpm) = beats × 60 / bpm`, and the reverse
- `sequenceToNoteEvents(sequence, bpm, { gate })`: a parsed melody → timed notes. The **gate** (90% for songs) leaves a gap so a repeated note strikes again
- `sanitizeNoteEvents(raw)`: turns *untrusted* data (an imported file, the worker's output) into valid notes. It rejects NaN, impossible pitches and notes that end before they start; repairs what it can (rounding, clamping, duplicate ids)
- `editNote(note, edit)`: what the editor calls; keeps pitch on the 88 keys, start ≥ 0, length ≥ 20 ms

### Why it's built this way
**Validate at every boundary.** Data that crosses into the app (a file, a worker message) is checked once, in one tested function, so nothing downstream needs to be defensive.

---

## `lib/music/sequence.ts` (extended)

Two additions to the melody format:

- **Triplets:** `G#3/8t` is two-thirds of an eighth. Positions are counted in whole **ticks** (24 per beat) and only divided at the end, so three triplets make exactly one beat. Adding thirds as floating-point numbers gives `0.9999999…`, and rounding each step drifts too; a test caught both
- **Parts:** `parseParts([rightHand, leftHand])` parses each hand and merges them, so a bass note can be held under a moving melody

---

## `lib/music/songs.ts` and `song-library.ts`

### Purpose
The Notes library: the `Song` model (categories, difficulty, tempo, time signature, `parts`, `source`, attribution) and its data.

### Why it's built this way
- **Data, not code** ([ADR 0009](../decisions/0009-data-driven-voice-recipes.md)): the player and UI work for any entry. `songTimeline(song)` converts and caches
- **Honest labels.** `source` is `riff` (a copyrighted hook, simplified by ear), `public-domain` or `original`, and the UI shows it. A test checks every riff's attribution says "by ear"
- **The tests are the reviewer:** every part parses, every note is on an 88-key piano, both hands have the same length in whole bars, every category has at least three songs
- **Curated picks** are a hand-picked pool, labelled "not live chart data". `curatedPicks(songs, seed)` shuffles with a seeded generator, so a seed always gives the same picks (testable)

### 🧪 Try it yourself
Add a public-domain piece: write each hand as a part, add the entry, run `npx vitest run songs`. A missing sixteenth fails the "whole bars" test and names the song.

---

## `lib/music/midi-file.ts`

A Standard MIDI File writer and reader, byte by byte: a header chunk, one track of delta-timed events (note on `0x9n`, note off `0x8n`, tempo `FF 51`), and **variable-length numbers** (7 bits per byte, high bit = "more follows"). At 480 ticks per quarter and 120 BPM a second is 960 ticks, so times round-trip within a millisecond. The reader follows running status and tempo changes; the tests round-trip a five-minute timeline.

---

## `lib/audio/sequence-player.ts`

### Purpose
The transport: play, pause, resume, stop, seek, speed and loop, with notes **booked ahead on the audio clock**. See [ADR 0013](../decisions/0013-play-sequences-on-the-audio-clock.md).

### Code explained
```ts
songTime(t)  = anchorSong + (t − anchorAudio) × rate     // where are we in the piece?
audioTime(s) = anchorAudio + (s − anchorSong) / rate     // when should song time s sound?
```
- `tick()` (every 25 ms) books each note whose start falls before `songTime(now + 0.2 s)`, at `audioTime(note.startTime)`
- Seek and resume set a new anchor and find the first note with a binary search
- Speed and loop changes **re-anchor**: notes already sounding carry on; notes booked for later are cancelled and booked again from the earliest one cancelled (each booking remembers its index and loop pass)
- It stops at `duration`, not the last note, so silence at the end of a recording plays out
- `soundingNotes()` returns bookings between their start and end: what to light

### Why it's built this way
Like the metronome, a plain class with the timing rules and no React or Web Audio, tested with a fake clock: exact times, chords, a one-minute silence, a five-minute piece, pause/resume/seek, speed changes mid-note, loops, and a regression test for a bug found while writing them (changing speed during the 50 ms start delay used to skip the first notes).

### 🧪 Try it yourself
Make seeking **chase** notes: when you seek into the middle of a long chord, start the notes still sounding at that point. Write the test first in `sequence-player.test.ts`.

---

## `lib/audio/audio-engine.ts` and `synth-voice.ts` (extended)

- `scheduleNote(frequency, options, start, end)` creates the voices at `start` and books their release at `end`
- `SynthVoice.cancel(time)` fades a voice out quickly **even if its release is already booked**: it computes the level the note has reached (including part-way through a release), replaces the booked automation from that time, and moves `stop()` earlier (a later `stop()` call replaces an earlier one). A voice booked for the future never sounds, hammer noise included

## `lib/voicing.ts`

`voiceNote(midi, settings, velocity)`: the voices (single/layer/split), tuned frequency and sounding pitch for a note. Extracted from `usePiano.noteOn` so your fingers and playback sound identical.

---

## `hooks/useSequencePlayer.ts`

Wraps the player for React. It lights keys from an animation-frame loop that sets state only when **the set of sounding keys changes**, and exposes the playhead as `getPosition()` rather than state, so only the small components that draw it (`usePlaybackPosition`) re-render 60 times a second. Loading a piece stops the previous one: one source at a time. When playback starts, `PianoApp` moves the keyboard to the octave that shows most of the piece (`bestOctaveShift`).

---

## `lib/transcription/` and `hooks/useTranscription.ts`

See [ADR 0014](../decisions/0014-transcribe-audio-in-the-browser.md) for why it runs in the browser.

| File | Job |
| --- | --- |
| `audio-file.ts` | Accept or reject a file: type (and whether *this* browser can decode it, via `canPlayType`), size, length; messages a person can act on |
| `decode.ts` | Decode into an `OfflineAudioContext` at 22 050 Hz (resampling on the way) and average to mono; read the length from the header without decoding |
| `notes-from-frames.ts` | The model's onset/frame matrices → notes: **30 s chunks** with 4 s of context (a note belongs to the chunk where it starts), overtone cleanup, piano notes |
| `run-model.ts` | What the worker does, with the model injected (so it's testable) |
| `transcription.worker.ts` + `worker-shims.ts` | The worker entry: picks WebGL or CPU, loads the model, and patches a TensorFlow.js 3 bug that hung jobs in workers |
| `transcriber.ts` | The page side: validation, staged progress, transfer of the samples, cancellation, a watchdog, and validating the worker's notes |
| `editor.ts` | The note editor as a reducer: select, edit, delete, add, undo, redo |
| `notes-file.ts` | The `.funkeys.json` format (notes and full duration; never the audio) |

`useTranscription` lives in `PianoApp`, not in the page, because the function pages unmount when you switch tabs: a transcription and your edits must survive that.

### 🧪 Try it yourself
1. Run `npm run fixture:piano` after changing the notes in `scripts/make-piano-fixture.mjs` (try a fast trill), then `npm run test:e2e -- -g transcribes` and read the recall/precision annotation
2. Add a "Quantize" button that snaps starts to the nearest sixteenth at a chosen tempo, as an editor action with tests

---

## Touch input: `lib/pointer-tracker.ts`, `piano/Piano.tsx`, `piano/KeyboardMinimap.tsx`

See [ADR 0015](../decisions/0015-docked-keyboard-on-phones.md).

- **One handler for every pointer.** Keys no longer listen for themselves; the keyboard captures each pointer on `pointerdown` and, on `pointermove`, asks `document.elementFromPoint` which key is under it (`data-note-id`). Moving to another key stops the old note and starts the new one: a glissando
- **`PointerTracker`** maps pointer id → key and counts fingers per key, so two fingers on one key stop it only when the last lifts. Pure, like `NoteTracker`
- **`touch-action: none` on the keys only**: a swipe on the keys plays instead of scrolling; the page scrolls everywhere else
- **The minimap** mirrors the rail's scroll position (`scrollLeft / scrollWidth`) and scrolls it when dragged; it's a `slider` for assistive technology
- **Dock and pin** are Tailwind custom variants in `globals.css`. The keyboard's height is published as `--keyboard-height` and used as `scroll-padding`, so focused controls never hide behind it

### 🧪 Try it yourself
Add **pressure**: on devices that report it, use `PointerEvent.pressure` instead of the press position for velocity. Test it by firing pointer events with a `pressure` in `Piano.test.tsx`.
