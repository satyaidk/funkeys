# Portfolio & interview guide

How to present this project on your resume, GitHub, LinkedIn and in interviews.

> **The golden rule:** only claim what you can explain. Interviewers *will* ask "how does that work?" and "why did you do it that way?". Read the [code walkthrough](./code-walkthrough/) and [ADRs](./decisions/) until you can explain every file without notes. Then everything below is genuinely yours to say.

---

## 1. Elevator pitch (30 seconds)

> "I built a browser piano you play with your computer keyboard. There are no audio files: every note is synthesized in real time with the Web Audio API, layering six harmonic oscillators with an ADSR envelope to get a piano-like tone. It's built with Next.js, TypeScript and Framer Motion, works with mouse, touch and keyboard, and has 76 automated tests and a CI pipeline. The most interesting part was tracking down race conditions that caused notes to get stuck."

## 2. Resume bullets

Pick 2–3. Each follows **action verb + what + how + result**:

- Built a real-time **browser piano** in **Next.js, React and TypeScript** that synthesizes sound with the **Web Audio API** (additive synthesis with 6 harmonic oscillators and an ADSR envelope), so no audio assets need downloading
- Designed a **layered architecture** (UI components → custom hooks → framework-free audio engine) that keeps the audio engine fully unit-testable and swappable
- Diagnosed and fixed **race conditions** that left notes stuck (async audio init, timer-based cleanup, Shift-modified key releases), each covered by a **regression test**
- Wrote **76 unit and integration tests** with **Vitest and React Testing Library**, including a custom fake Web Audio API, and automated lint/typecheck/test/build in **GitHub Actions CI**
- Built a **responsive, accessible UI** (ARIA roles, reduced-motion support, CSS `clamp()` sizing from 320px phones to desktop) with **Framer Motion** spring animations
- Documented the system with an architecture guide, **5 Architecture Decision Records**, and per-file code walkthroughs

**Skills line:** TypeScript · React · Next.js (App Router) · Tailwind CSS · Framer Motion · Web Audio API · Vitest · React Testing Library · GitHub Actions · Accessibility (WCAG/ARIA)

## 3. Interview stories (STAR format)

Behavioral interviews ask "tell me about a hard bug" or "a time you made a trade-off". Use **S**ituation, **T**ask, **A**ction, **R**esult.

### Story 1: The stuck-note race condition

- **Situation:** Users could get a note stuck playing forever if they pressed the same key twice quickly.
- **Task:** Find the root cause and make sure it couldn't come back.
- **Action:** I traced it to the audio engine: on release, a `setTimeout` removed the note from the active-notes map *after* the fade-out. A second press during the fade created a new voice under the same key, then the old timer deleted *that* entry, so the next key-up found nothing to stop. I changed release to remove the entry immediately and free the audio nodes in the oscillator's `onended` event instead. Then I wrote a regression test using a fake `AudioContext` that replays the exact sequence.
- **Result:** The bug is fixed and guarded by a test. I also learned to look for shared mutable state touched by delayed callbacks, a pattern I then found in two other places (async init and Shift-modified key releases).

### Story 2: A trade-off decision (synthesis vs. samples)

- **Situation:** A piano needs realistic sound, but real piano samples are megabytes of downloads.
- **Action:** I compared full samples, sparse samples with pitch shifting, a library like Tone.js, and synthesis, then documented the options in an ADR.
- **Result:** I chose synthesis: instant load, any pitch, and full control. I accepted a less realistic timbre, and isolated the engine behind a hook so samples could be swapped in later without touching the UI.

### Story 3: Making it work everywhere

- **Situation:** The keyboard was 620px wide and broke on phones; touching keys scrolled the page; the volume slider stole keyboard input.
- **Action:** I sized keys with CSS variables and `clamp()` (no JS resize logic), unified mouse and touch with Pointer Events, disabled touch scrolling on keys, and narrowed the "is the user typing?" check to text inputs only.
- **Result:** It works from 320px phones to desktops (checked at 320, 375 and 1280px), with an automated test for each input fix.

## 4. Technical questions you should be ready for

| Question | Where to study |
| --- | --- |
| How do you generate a note's frequency? | [Music theory §5](./concepts/music-theory.md#5-the-frequency-formula) |
| What's an ADSR envelope, and how is it scheduled? | [Web Audio §5](./concepts/web-audio.md#5-the-adsr-envelope-how-volume-changes-over-time) |
| Why can't you start audio on page load? | [Web Audio §8](./concepts/web-audio.md#8-the-autoplay-policy) |
| `useRef` vs `useState`? Why both in `usePiano`? | [ADR 0002](./decisions/0002-refs-plus-state-for-note-tracking.md) |
| What does `useCallback` actually buy you here? | [React patterns §6–7](./concepts/react-patterns.md#6-usecallback-and-usememo-stable-identities) |
| `event.key` vs `event.code`? | [ADR 0003](./decisions/0003-track-physical-keys-with-event-code.md) |
| Server vs Client Components? | [Architecture §5](./architecture.md#5-server-vs-client-components) |
| How do you test code that uses browser APIs jsdom lacks? | [Testing §6](./testing.md#6-testing-the-audio-engine-without-audio-the-fake-audiocontext) |
| How would you scale this (more instruments, recording, MIDI)? | [Roadmap](./roadmap.md) |
| What would you do differently? | [Architecture §13](./architecture.md#13-known-limitations) |

## 5. Make the GitHub repo shine

Recruiters spend about 30 seconds on a repo. Checklist:

- [ ] **Deploy it** (Vercel, free) and put the live link at the top of the README
- [ ] Add a **GIF or screenshot** of playing a chord to the README (tools: ScreenToGif on Windows, Kap on macOS)
- [ ] Give the repo a clear **name** and **description** (e.g. `keyboard-piano`: "Play piano with your keyboard: Next.js + Web Audio API")
- [ ] Add **topics**: `nextjs`, `typescript`, `web-audio-api`, `react`, `tailwindcss`, `framer-motion`
- [ ] Make sure the **CI badge** is green
- [ ] **Pin** the repo on your GitHub profile
- [ ] Choose a **license** (MIT is common for portfolio projects)
- [ ] Write clean **commit messages** from now on (see [development guide](./development.md#commit-messages-conventional-commits))

## 6. Demo script (2 minutes, for interviews or a video)

1. **Hook (10s):** Play a recognizable melody or a chord progression.
2. **What (20s):** "Every sound is generated live; there are no audio files."
3. **Features (40s):** Shift octaves (Z/X), toggle sustain and show the soft-glow sustained notes, click and tap keys, drag volume while playing.
4. **Under the hood (40s):** Open Chrome DevTools → WebAudio panel to show nodes being created and freed; briefly show the layered folder structure.
5. **Quality (10s):** Run `npm test`: 76 green tests in about 5 seconds.

## 7. LinkedIn post template

> 🎹 Weekend project: a piano you play with your computer keyboard, and every note is synthesized live in the browser.
>
> What I learned building it:
> • How sound synthesis works (harmonics + ADSR envelopes) with the Web Audio API
> • Debugging race conditions that left notes stuck, and pinning them down with regression tests
> • Structuring a React app in layers so the audio engine is testable on its own
>
> Stack: Next.js · TypeScript · Tailwind · Framer Motion · Vitest
> 🔗 Live demo: [link]  💻 Code: [link]
>
> #webdev #typescript #nextjs #react
