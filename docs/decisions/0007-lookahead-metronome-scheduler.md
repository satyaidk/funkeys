# ADR 0007: Schedule metronome clicks ahead on the audio clock

- **Status:** Accepted
- **Area:** Metronome (`lib/audio/metronome.ts`, `hooks/useMetronome.ts`)

## Context

A metronome is only useful if it's steady. The obvious implementation, `setInterval(click, 60000 / bpm)`, runs on the JavaScript main thread. Rendering, garbage collection or a busy tab can delay timers by tens of milliseconds, which is clearly audible as an uneven beat, especially while React is re-rendering keys as you play.

## Decision

Use a **lookahead scheduler** (Chris Wilson, *A Tale of Two Clocks*):

- A JavaScript timer wakes every **25 ms**
- Each time, it books every click due in the next **120 ms** using `AudioEngine.scheduleClick(time)` at the exact **audio-clock** time
- The scheduler depends on a two-member `MetronomeClock` interface (`currentTime`, `scheduleClick`), not on the engine class
- The visual beat light is delayed by `clickTime − currentTime` so it flashes when the click is heard

## Alternatives considered

| Option | Why not |
| --- | --- |
| `setInterval` playing clicks immediately | Audible jitter under load |
| Schedule all clicks for minutes ahead | Tempo and time-signature changes would need cancelling hundreds of events |
| `AudioWorklet` with sample counting | Precise, but far more complex than needed for a metronome |
| A library (Tone.js Transport) | Adds a dependency and hides the concept |

## Consequences

- ✅ Sample-accurate clicks even while the UI is busy
- ✅ Tempo changes take effect from the next unbooked click (≤ 120 ms later)
- ✅ Fully unit-testable with a fake clock and fake timers (12 tests)
- ⚠️ Changing tempo isn't instant: up to one lookahead window of already-booked clicks plays at the old tempo
