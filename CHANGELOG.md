# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

The digital piano release: real-piano functions, a bigger keyboard and a redesigned interface.

### Added
- **37-key keyboard (C3–C6)** on all four letter/number rows, laid out as two piano-shaped manuals; layout-aware key labels via the Keyboard Map API
- **8 voices**: Concert grand, Bright grand, Electric piano (FM), Harpsichord, Drawbar organ, String ensemble, Vibraphone, Celesta
- **Layer** (two voices per key, with balance) and **Split** (left-hand voice, movable split point) modes
- **Three pedals**: soft (hold Shift), sostenuto (on screen), sustain (hold Space or latch on screen)
- **Touch sensitivity** (Light / Medium / Heavy / Fixed); mouse and touch velocity from press position
- **Reverb** (Room / Concert hall / Cathedral, with depth) and **brilliance** (Mellow / Normal / Bright)
- **Transpose** (±12, ↑/↓), **master tuning** (A4 415.3–466.2 Hz) and **six temperaments** with selectable key
- **Metronome**: 30–240 BPM with tempo markings, 2/4 to 6/8, accents, tap tempo, click volume, beat lights
- **Recorder**: record, play back (keys light up), stop, delete
- **Notes page** (next to Metronome): famous riffs that loop on the keyboard until you stop them, keys lighting up as they play: Tokyo Drift, Lean On and Taki Taki (DJ Snake), Megalovania, Axel F, Seven Nation Army, He's a Pirate, Für Elise; practice speed 50–125%
- Melody text format and parser (`lib/music/sequence.ts`), song library (`riffs.ts`), drift-free `Looper` scheduler and `useLooper` hook
- Sound realism: string inharmonicity, natural decay while held, velocity-dependent brightness, hammer/pluck noise, stereo spread, 64-voice polyphony with voice stealing
- Redesigned **hardware-style interface**: dot-matrix LCD, knobs, LED pads, function tabs, fallboard wordmark, walnut cheeks and brass pedals; one power-on light sweep
- UI primitives in `components/ui/`: `Knob`, `SegmentedControl`, `RadioPads`, `Stepper`, `PadButton`, `Led`, `Field`
- Pure `NoteTracker` pedal state machine and validated settings (`lib/settings.ts`)
- 181 new tests (257 total)
- Docs: digital-piano functions guide with sources, a seven-part code walkthrough, ADRs 0006–0012

### Changed
- Octave shift moved to ← / →; sustain is now held (Space) rather than toggled
- `lib/` split into `lib/music/` and `lib/audio/`; components regrouped into `console/`, `piano/` and `ui/`
- Notes are matched by physical key (`event.code`) for press and release (ADR 0006 supersedes ADR 0003)

### Fixed
- CI type-check failing with `Cannot find name 'LayoutProps'` on a fresh checkout: `npm run typecheck` now runs `next typegen` first to generate Next.js route types

### Removed
- `ControlPanel`, `NowPlaying` and `Header` (replaced by the console, the LCD and the page header)

## [0.2.0] - 2026-10-03

The engineering foundation.

### Added
- Documentation site in `docs/`: architecture, concept guides, per-file code walkthrough, ADRs 0001–0005, testing and development guides, roadmap and portfolio guide
- Test suite (76 tests) with Vitest, React Testing Library and a fake Web Audio API
- GitHub Actions CI: lint, type-check, test and build on pushes and PRs to `dev` and `prod`
- `typecheck`, `test`, `test:watch` and `validate` scripts
- Reduced-motion support, custom tab icon, Open Graph metadata

### Changed
- Components organized by feature; `@types/node` upgraded to v24 (required by Vitest 5)

### Removed
- Unused create-next-app assets

## [0.1.0] - 2026-10-03

### Added
- Playable 17-key piano (C4–E5) mapped to the computer keyboard, with mouse and touch support
- Web Audio synthesis engine: 6 harmonic oscillators per note, ADSR envelope, low-pass filter, master compressor
- Volume, octave shift and sustain controls with keyboard shortcuts
- Responsive keyboard and animated UI with per-note rainbow colors

### Fixed
- Notes stuck on when replayed during their release fade
- Notes stuck on after a very quick first tap (async audio initialization)
- Notes stuck on when released with Shift held
- Volume changes ignored before the first note
- Volume slider focus blocking keyboard play
- Ctrl+Z / Ctrl+X changing the octave
- Turning sustain off cutting notes that were still held
- Hovering over a key stopping a note held on the keyboard
