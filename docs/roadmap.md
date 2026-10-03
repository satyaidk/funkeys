# Roadmap: features to build next

Ideas to grow the project, ordered roughly from easiest to hardest. Each one teaches a specific skill. **Build these yourself.** That's where the real learning (and the best interview stories) come from.

For each: create a branch, follow the [feature walkthrough](./development.md#5-walkthrough-adding-a-feature-end-to-end), add tests, and update the docs.

---

## 🟢 Beginner

### 1. Remember settings between visits
Save volume and octave to `localStorage` and restore them on load.
- **Skills:** browser storage, `useEffect`, hydration safety (the server doesn't have `localStorage`)
- **Files:** `usePiano.ts`
- **Watch out:** wrap storage access in `try/catch`, because private browsing can throw

### 2. Hold-to-sustain pedal
Sustain while Space is **held**, release on key-up, like a real pedal.
- **Skills:** keyboard events, keeping tests in sync with behavior changes
- **Files:** `usePiano.ts`, `usePiano.test.tsx`

### 3. Show / hide labels
A toggle to hide note names and key letters, for practicing by ear.
- **Skills:** prop drilling vs. context, conditional rendering
- **Files:** `ControlPanel.tsx`, `PianoKey.tsx`

## 🟡 Intermediate

### 4. Sound presets (piano / organ / retro)
Let users choose different harmonic recipes and wave shapes.
- **Skills:** extending a class API, design of configuration objects
- **Files:** `constants.ts`, `audio-engine.ts`, new `controls/SoundSelect.tsx`
- **Bonus:** write an ADR explaining your preset design

### 5. Record and play back
A ⏺ button records note events with timestamps; ▶ replays them.
- **Skills:** modelling time-based data, `performance.now()`, scheduling with the audio clock, state machines (idle → recording → playing)
- **Files:** new `hooks/useRecorder.ts`, new `controls/Transport.tsx`
- **Hint:** store `{ noteId, frequency, type: 'start' | 'stop', time }[]`

### 6. Falling-notes visualizer
Notes rise above the keyboard as colored bars while you play (like Synthesia).
- **Skills:** `requestAnimationFrame`, canvas or SVG, performance profiling
- **Files:** new `components/piano/NoteVisualizer.tsx`

### 7. Chord detection
Display the chord name ("C major", "A minor 7") for the notes being held.
- **Skills:** algorithms, pure functions, table-driven tests
- **Files:** new `lib/chords.ts` + `chords.test.ts`

## 🔴 Advanced

### 8. MIDI keyboard support
Play with a real USB piano keyboard via the **Web MIDI API**, including velocity (how hard you hit).
- **Skills:** hardware APIs, permissions, feature detection, mapping MIDI numbers (you already have the formula!)
- **Files:** new `hooks/useMidiInput.ts`; add a `velocity` parameter to `playNote`

### 9. Voice limit (polyphony cap)
Cap simultaneous voices (e.g. 24) and steal the oldest when exceeded.
- **Skills:** resource management, data structures (queues), performance under load
- **Files:** `audio-engine.ts`, `audio-engine.test.ts`

### 10. Realistic sound with samples
Load real piano recordings and play them with `AudioBufferSourceNode`, keeping the same engine API.
- **Skills:** async loading, caching, loading states, the Strategy pattern
- **Files:** new `lib/sample-engine.ts`; swap it in `useAudioEngine.ts`
- **Bonus:** write ADR 0006 that *supersedes* [ADR 0001](./decisions/0001-synthesize-sound-instead-of-samples.md)

## 🛠 Engineering quality

| Task | Skill |
| --- | --- |
| **End-to-end tests with Playwright** (real Chrome: press keys, assert UI) | E2E testing |
| **Test coverage report** (`@vitest/coverage-v8`) and a coverage badge | Measuring quality |
| **Prettier** + format check in CI | Consistent formatting at scale |
| **Lighthouse CI** (performance and accessibility scores on each PR) | Web performance |
| **Deploy to Vercel** with preview deployments per PR | Delivery pipelines |
| **Error boundary** (`app/error.tsx`) with a friendly message | Resilience |
| **Open Graph image** (`app/opengraph-image.tsx`) for share previews | Next.js metadata |
