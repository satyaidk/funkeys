# ADR 0014: Transcribe audio in the browser with Basic Pitch, in a Web Worker

- **Status:** Accepted
- **Area:** Audio to Piano (`lib/transcription/`, `hooks/useTranscription.ts`, `public/models/basic-pitch/`)

## Context

Audio to Piano turns a piano recording into notes the FunKeys piano plays. That needs **automatic music transcription**: finding pitch, start and end of every note, including chords. The site is a static Next.js app on Vercel with no backend.

We evaluated [Spotify's Basic Pitch](https://github.com/spotify/basic-pitch-ts) (`@spotify/basic-pitch` 1.0.1, Apache-2.0) by reading its source in the installed package rather than its README example:

- A ~0.9 MB TensorFlow.js graph model that hears polyphony; it outputs, every 11.6 ms, a probability per key that a note *starts* (onsets) and that one *sounds* (frames)
- Depends on TensorFlow.js **3.21** and `@tonejs/midi`
- Its decoder `outputToNotesPoly` repeatedly scans the *whole* output for leftover energy, so its cost grows much faster than the recording
- It never disposes intermediate tensors, so memory grows with the length of the recording

Where should it run?

| | Browser | Server (Vercel function) |
| --- | --- | --- |
| Upload limit | None (file stays local) | 4.5 MB request body: a 5-minute WAV is ~50 MB |
| Speed | GPU via WebGL: many times faster than real time | CPU only; `tfjs-node` is too large for a function bundle |
| Privacy | Recording never leaves the device | Upload and temporary storage |
| Cost | Free | Function time per minute of audio |

## Decision

- **Run it in the browser, in a Web Worker.** The page stays responsive (the piano keeps playing) during a transcription. Each job gets a fresh worker, terminated afterwards or on Cancel, which frees every tensor and the GPU context at once (this also contains the library's tensor leak).
- **Decode in the page, analyze in the worker.** `decodeAudioData` into an `OfflineAudioContext` at 22 050 Hz resamples on the way; channels are averaged to mono; the samples are *transferred* (not copied) to the worker.
- **Validate before decoding.** Type (and whether *this* browser can decode it), size (≤ 100 MB) and length (≤ 10 minutes, read from the file header without decoding) are checked first, with plain-language messages.
- **Decode notes in 30-second chunks** with 4 s of context each side; a note belongs to the chunk where it starts. A test checks chunked and single-pass decoding give identical notes.
- **Optional overtone cleanup** (on by default): drop a note an octave/twelfth/… above a note starting with it *and* under 60% of its strength. Measured on our fixture, every false note was such an overtone at ~0.33 strength while real notes were ≥ 0.56.
- **WebGL first, CPU fallback**, chosen at runtime inside the worker.
- **Serve the model from `public/`**, committed, with a test that fails if it ever differs from the installed package (`npm run sync:model` copies it). No CDN at runtime.
- **Work around a TensorFlow.js 3 worker bug:** its `setTimeoutCustom` evaluates `window`, which doesn't exist in a worker, and the job hung. A tiny shim declares `window` as `undefined` (so `typeof window` is unchanged). A watchdog fails the job if the worker goes silent for 90 s, and the worker reports unhandled errors, so a future bug like this can't hang the page.
- **Never trust data crossing a boundary:** notes from the worker are validated again (`sanitizeNoteEvents`).

## Alternatives considered

| Option | Why not |
| --- | --- |
| Server-side transcription | Upload limits, no GPU, cost, privacy (see the table) |
| Run on the main thread | Freezes the page (and the piano) during decoding |
| Upgrade to TensorFlow.js 4 | Basic Pitch requires 3.x; two copies would ship |
| WebAssembly backend for the CPU path | Faster than plain-JS CPU, but ~10 MB more dependency and three `.wasm` builds to serve, for a fallback most browsers don't need |
| Load the model from a CDN | A runtime dependency on a third party; the app wouldn't work offline or if the CDN changed |

## Consequences

- ✅ Measured on a synthesized fixture with known notes (`e2e/fixtures/piano-fixture.*`, 25 notes: a scale, 1.5 s of silence, four-note chords, a melody over a held bass): **25/25 notes found, precision 1.00, mean onset error 5.2 ms**, duration preserved to the millisecond, in headless Chromium
- ✅ Private by design: nothing is uploaded or stored
- ⚠️ **On the CPU fallback it's slow:** about 2× real time (23 s for 11.5 s of audio in headless Chromium without a GPU), so a five-minute recording takes around ten minutes. Browsers with OffscreenCanvas WebGL in workers (current Chrome, Edge, Firefox 105+, Safari 16.4+) use the GPU
- ⚠️ The fixture is synthesized, not a recorded piano; real recordings (room sound, pedal, mixed dynamics) will score lower. The editor exists because transcription is an estimate
- ⚠️ Very long held notes (more than 4 s past a chunk boundary) are cut at the context edge
- ⚠️ The whole recording is decoded in memory: on phones, long files can exhaust memory before the 10-minute limit
