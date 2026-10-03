# ADR 0001: Synthesize sound with oscillators instead of audio samples

- **Status:** Accepted
- **Area:** Audio (`src/lib/audio-engine.ts`)

## Context

A piano app needs a sound for every note. There are two broad approaches:

1. **Samples**: recordings of a real piano, one file per note (or every few notes, pitch-shifted), played back on demand
2. **Synthesis**: generate the waveform mathematically in real time with Web Audio oscillators

Forces at play:

- The app should load **instantly** and work offline once loaded
- This is a learning project, so understanding *how sound works* is a goal
- Octave shifting means the playable range is C2–E7, and every note needs a sound
- No budget for licensed sample libraries

## Decision

**Synthesize every note** using additive synthesis: 6 oscillators per note at harmonic ratios (1×–6×) with decreasing amplitudes, shaped by an ADSR envelope and a low-pass filter.

## Alternatives considered

| Option | Pros | Cons |
| --- | --- | --- |
| **Synthesis (chosen)** | Zero downloads; any pitch at any octave; fully tunable in code; teaches audio fundamentals | Sounds like an electric piano, not a concert grand |
| Full sample set (88 notes) | Most realistic | Tens of MB to download; licensing; slow first load |
| Sparse samples + pitch shifting | Realistic, smaller | Still several MB; needs a loading state and sample library |
| Third-party library (e.g. Tone.js) | Less code to write | Hides the concepts this project exists to teach; adds a dependency |

## Consequences

- ✅ The page is tiny and interactive immediately, with no loading spinner
- ✅ Every tone parameter (harmonics, envelope, filter) lives in `constants.ts` and can be tweaked
- ✅ The engine is fully unit-testable with a fake `AudioContext`
- ⚠️ The timbre is less realistic than a sampled grand piano
- ⚠️ CPU cost grows with polyphony (6 oscillators per voice). Fine for normal playing; a voice limit could be added
- 🔄 Because `useAudioEngine` is the only file that knows about `AudioEngine`, a sample-based engine with the same API could be swapped in later without touching any component
