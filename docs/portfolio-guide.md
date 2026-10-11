# Portfolio & interview guide

How to present this project on your resume, GitHub, LinkedIn and in interviews.

> **The golden rule:** only claim what you can explain. Interviewers *will* ask "how does that work?" and "why that way?". Work through the [code walkthrough](./code-walkthrough/) and the [ADRs](./decisions/) until you can explain every file without notes. Then everything below is yours to say.

---

## 1. Elevator pitch (30 seconds)

> "I built a browser-based digital piano. All four rows of your computer keyboard become a 37-key, two-manual keyboard, and every sound is synthesized live with the Web Audio API. There are eight voices, from a concert grand with string inharmonicity to an FM electric piano. I researched real digital pianos and implemented their functions: layer and split, all three pedals including sostenuto, touch curves, reverb, master tuning and historical temperaments, a metronome scheduled on the audio clock and a recorder. On top of that there's a library of songs that play on the keys, and Audio to Piano: you give it a piano recording, Spotify's open-source Basic Pitch model transcribes it in a Web Worker right in the browser, you fix any wrong notes in a piano-roll editor, and FunKeys plays it back on its own piano with the keys lighting up, across the recording's full length. It works with multi-touch on phones too. It's Next.js and TypeScript with 448 unit tests, Playwright end-to-end tests and CI."

## 2. Resume bullets

Pick 3–4. Each is **action + what + how + result**:

- Built a **browser-based digital piano** in **Next.js, React and TypeScript** with 8 voices synthesized in real time via the **Web Audio API**: additive partials with inharmonicity, **FM synthesis**, LFO vibrato/tremolo, convolution reverb and a 64-voice polyphony limit
- Implemented **real digital-piano functions** researched from Yamaha and Roland manuals: layer/split modes, **sustain, sostenuto and soft pedals**, touch curves, transpose, master tuning (415–466 Hz) and **six historical temperaments**
- Designed a **layered architecture** (UI → hooks → framework-free core) with pedal logic as a **pure state machine** and data-driven voice recipes, documented in **15 Architecture Decision Records**
- Engineered a **sample-accurate metronome** with a lookahead scheduler on the audio clock, immune to main-thread jitter
- Built **in-browser audio-to-MIDI transcription** with Spotify's **Basic Pitch** (TensorFlow.js) in a **Web Worker**, with chunked decoding to bound cost on long recordings; **25/25 notes recovered, 5 ms mean onset error** on a test recording with known notes
- Replaced a timer-based looper with a **lookahead scheduler on the Web Audio clock** supporting play/pause/seek/speed/loop over 5-minute timelines, tested with a fake clock
- Wrote **448 unit and integration tests** (Vitest, React Testing Library) using a custom **fake Web Audio API** and fake clocks, plus **Playwright end-to-end tests** including multi-touch chords and layout checks at 8 viewport widths; automated in **GitHub Actions**
- Built an **accessible hardware-style UI design system** (knobs, steppers, radio groups, tabs with ARIA roles and keyboard support) with **Framer Motion**, responsive from phones to desktop

**Skills line:** TypeScript · React 19 · Next.js 16 · Tailwind CSS 4 · Framer Motion · Web Audio API · Web Workers · TensorFlow.js · DSP basics · Vitest · React Testing Library · Playwright · GitHub Actions · WAI-ARIA accessibility

## 3. Interview stories (STAR)

### Story: the transcription that never finished
- **Situation:** Audio to Piano worked in unit tests, but in a real browser the progress bar froze at 12% forever, with only "window is not defined" in the console.
- **Task:** Find why, and make sure a hang like it could never leave the user waiting again.
- **Action:** Searched the built worker bundle for unguarded `window` uses and found TensorFlow.js 3's `setTimeoutCustom`, which evaluates `window && …`: in a Web Worker there is no `window`, so it threw inside a timer and the promise never settled. Upgrading wasn't possible (Basic Pitch pins TF.js 3), so I added a two-line shim that declares `window` as `undefined` (keeping `typeof window` unchanged), then hardened the boundary: the worker reports unhandled errors and rejections, and the page has a watchdog that fails cleanly after 90 s of silence, with a regression test.
- **Result:** Transcription completes in real Chromium (25/25 notes on the test recording), and any future engine failure surfaces as a clear message instead of a frozen bar.
- **Lesson:** Unit tests with fakes can't catch environment bugs; an end-to-end test with the real dependency found it in minutes.

### Story: three triplets aren't one beat
- **Situation:** Adding triplets to the melody format, a test expected three triplet eighths to end exactly on beat 1; they ended at 0.999999999.
- **Action:** Rounding after each step still drifted (3 × 0.333333333). Instead I counted positions in whole **ticks** (24 per beat, a common multiple of every note value, dotted and triplet) and divided only at the end.
- **Result:** Exact arithmetic for every note value, and a regression test that pins it.

### Story 1: The stuck-note race condition
- **Situation:** Pressing the same key twice quickly could leave a note ringing forever.
- **Task:** Find the root cause and make sure it couldn't return.
- **Action:** I traced it to the engine: a `setTimeout` removed a note from the active map *after* its fade-out, so a second press during the fade created a new voice that the old timer then deleted. I changed release to forget the note immediately and free audio nodes from the oscillator's `ended` event, then wrote a regression test that replays the exact sequence against a fake AudioContext.
- **Result:** Fixed and guarded by a test. I learned to look for shared mutable state touched by delayed callbacks, and found the same class of bug in async audio init and Shift-modified key releases.

### Story 2: Making the metronome steady
- **Situation:** A `setInterval` metronome drifted audibly whenever React re-rendered keys.
- **Action:** I implemented a lookahead scheduler: a 25 ms timer books clicks 120 ms ahead at exact audio-clock times, behind a two-method clock interface so it's testable with a fake clock. Beat lights are delayed to match when each click is heard.
- **Result:** Sample-accurate timing regardless of UI load, documented in ADR 0007, with 12 tests.

### Story 3: Getting the sostenuto pedal right
- **Situation:** Sostenuto has subtle rules: it holds only notes down when pressed, and also catches notes the sustain pedal is holding.
- **Action:** Instead of adding conditions to the React hook, I extracted a pure `NoteTracker` state machine whose methods return decisions ("stop these notes"), and a "pedal sources" model so keyboard, screen and playback can each hold a pedal.
- **Result:** Every combination covered by fast unit tests; the hook became simple orchestration ("functional core, imperative shell").

### Story 4: A trade-off decision (synthesis vs. samples)
- **Action:** Compared samples, sparse samples, Tone.js and synthesis; documented in ADR 0001; later extended to data-driven recipes (ADR 0009).
- **Result:** Instant load and full control, with the engine isolated so samples could be added later.

## 4. Technical questions to prepare

| Question | Study |
| --- | --- |
| How do you calculate a note's frequency? With a temperament? | [Music theory §5–8](./concepts/music-theory.md#5-the-frequency-formula) |
| What is FM synthesis? Inharmonicity? | [Web Audio §3, §6](./concepts/web-audio.md#3-additive-synthesis-partials) |
| Why can't `setInterval` drive a metronome? | [ADR 0007](./decisions/0007-lookahead-metronome-scheduler.md) |
| What does the sostenuto pedal do, and how did you model it? | [Piano functions](./concepts/piano-functions.md#the-three-pedals), [ADR 0008](./decisions/0008-pedal-logic-as-a-pure-state-machine.md) |
| `event.key` vs `event.code`? | [ADR 0006](./decisions/0006-map-notes-by-physical-key.md) |
| `useRef` vs `useState`? | [ADR 0002](./decisions/0002-refs-plus-state-for-note-tracking.md) |
| How do you test code that uses browser APIs jsdom lacks? Time? | [Testing §6–7](./testing.md#6-testing-audio-without-speakers-the-fake-audiocontext) |
| How did you make custom controls accessible? | [React patterns §9](./concepts/react-patterns.md#9-accessible-widgets-roving-tabindex) |
| How did you approach the visual design? | [ADR 0011](./decisions/0011-instrument-as-interface.md) |
| What would you do next? | [Roadmap](./roadmap.md) |

## 5. Make the repo shine

- [ ] **Deploy** (Vercel, free) and put the link at the top of the README
- [ ] Record a **GIF**: play a chord with sustain, switch to Layer, start the metronome (ScreenToGif on Windows)
- [ ] Repo **name/description**: `keyboard-piano`, "A browser digital piano: 8 synthesized voices, pedals, tunings, metronome & recorder. Next.js + Web Audio"
- [ ] **Topics:** `nextjs`, `typescript`, `web-audio-api`, `react`, `tailwindcss`, `synthesizer`, `music`
- [ ] Green **CI badge**; **pin** the repo; choose a **license** (MIT is common)
- [ ] Clean **commit messages** from now on

## 6. Demo script (2 minutes)

1. **Hook (15s):** Play a chord progression with sustain held.
2. **Voices (20s):** Switch to Electric piano, then Layer grand + strings.
3. **Real-piano functions (30s):** Split with a left-hand voice; transpose +2; switch to Werckmeister and play a C major chord in two keys to hear the difference.
4. **Metronome + recorder (25s):** Start the metronome, tap a tempo, record 8 bars, play it back while the keys light up.
5. **Under the hood (20s):** Chrome DevTools → WebAudio panel (nodes appearing and freeing); the layered folders.
6. **Quality (10s):** `npm test`: 448 green tests; `npm run test:e2e`: the app driven in a real browser.

## 7. LinkedIn post template

> 🎹 I built a digital piano that runs in your browser: all four rows of your keyboard become 37 keys, and every sound is synthesized live.
>
> What I learned:
> • Sound synthesis with the Web Audio API: partials, FM, envelopes, convolution reverb
> • How real pianos work (sostenuto pedal, temperaments, touch curves) and how to model them in code
> • Scheduling audio on the audio clock so the metronome never drifts
> • Running a music-transcription model (Spotify's Basic Pitch) in a Web Worker
> • Testing it all: 448 tests with a fake Web Audio API, plus Playwright in a real browser
>
> Stack: Next.js · TypeScript · Tailwind · Framer Motion · Vitest
> 🔗 Demo: [link]  💻 Code: [link]
>
> #webdev #typescript #nextjs #react #webaudio
