# Roadmap

What's done, and ideas to build next, ordered roughly by difficulty. **Build these yourself.** That's where the real learning, and the best interview stories, come from. For each: branch, follow the [feature walkthrough](./development.md#5-walkthroughs), add tests, update the docs.

---

## ✅ Done

- 37-key two-manual keyboard on all four rows, layout-aware labels
- 8 voices, Layer and Split modes
- Soft, sostenuto and sustain pedals (hold-to-sustain on Space)
- Touch curves, reverb rooms, brilliance
- Transpose, master tuning, 6 temperaments
- Metronome with tap tempo; performance recorder
- Hardware-style UI with a design system, 220 tests, CI

## 🟢 Beginner

### 1. Remember settings between visits
Save `settings` (and metronome tempo) to `localStorage`, restore on load.
- **Skills:** browser storage, hydration (the server has no `localStorage`; load after mount)
- **Files:** `usePiano.ts`, `lib/settings.ts` (reuse `sanitizeSettings` to validate what you load)

### 2. A sostenuto key
Map a key (e.g. `Backslash`) to the sostenuto pedal.
- **Skills:** keyboard events, extending tests
- **Files:** `usePiano.ts`, `usePiano.test.tsx`, `PedalUnit.tsx` (show the shortcut)

### 3. Show / hide labels
A toggle to hide key letters for ear training.
- **Files:** `SoundPanel.tsx` or the fallboard, `PianoKey.tsx`

### 4. Mouse-wheel on knobs
- **Skills:** native listeners with `{ passive: false }`
- **Files:** `ui/Knob.tsx`

## 🟡 Intermediate

### 5. Chord detection on the LCD
Show "C major", "A minor 7" for the held notes.
- **Skills:** algorithms, pure functions, table-driven tests
- **Files:** new `lib/music/chords.ts` + tests; `Display.tsx`

### 6. Falling-notes visualizer
Colored bars rising above the keys as you play.
- **Skills:** `requestAnimationFrame`, canvas, profiling
- **Files:** new `components/piano/NoteVisualizer.tsx`

### 7. Export and import recordings
Download a take as JSON, load it back; then as a **MIDI file**.
- **Skills:** file APIs, binary formats (MIDI is a nice byte-level exercise)
- **Files:** `useRecorder.ts`, new `lib/midi-file.ts`

### 8. Damper resonance
Gentle sympathetic ringing while sustain is down, like a real grand.
- **Skills:** audio design, extending the engine
- **Files:** see the [walkthrough](./development.md#adding-a-function-page-a-full-feature)

### 9. Metronome rhythms
Replace the click with simple drum patterns, as many digital pianos do.

## 🔴 Advanced

### 10. MIDI keyboard input (Web MIDI API)
Play with a real USB keyboard, with **velocity** and sustain-pedal messages.
- **Skills:** hardware APIs, permissions, feature detection
- **Files:** new `hooks/useMidiInput.ts` calling `noteOn(id, velocity)` and `setPedal('sustain', …, 'midi')`

### 11. Sampled grand piano
Load real piano recordings with `AudioBufferSourceNode`, keeping the engine API.
- **Skills:** async loading, caching, loading states, the Strategy pattern
- **Bonus:** write ADR 0012 superseding [ADR 0001](./decisions/0001-synthesize-sound-instead-of-samples.md)

### 12. Duet mode
Split the keyboard into two identical ranges for teacher and student, as on Yamaha and Roland pianos.

## 🛠 Engineering quality

| Task | Skill |
| --- | --- |
| **Playwright E2E tests** (real Chrome: press keys, assert the LCD) | End-to-end testing |
| **Coverage report** (`@vitest/coverage-v8`) + badge | Measuring quality |
| **Prettier** + format check in CI | Consistent formatting |
| **Lighthouse CI** (performance and accessibility scores per PR) | Web performance |
| **Deploy to Vercel** with preview deployments | Delivery |
| **Error boundary** (`app/error.tsx`) | Resilience |
| **Open Graph image** (`app/opengraph-image.tsx`) | Share previews |
