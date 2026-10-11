# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### FunKeys: Audio to Piano, a song library, and the piano on phones

#### Added
- **Audio to Piano**: transcribe a piano recording (WAV, MP3, and OGG/FLAC/M4A/WebM where the browser decodes them; up to 10 minutes and 100 MB) into notes with Spotify's **Basic Pitch**, in a Web Worker, entirely in the browser; staged progress, cancel, clear errors, WebGL with a CPU fallback (ADR 0014)
- **Piano-roll editor** for transcriptions: select, change pitch/start/length/velocity, delete, add, undo/redo; preview a note
- **MIDI export and import**, and a FunKeys notes file (`.funkeys.json`) that keeps the recording's full length
- **Audio-clock playback** for songs and transcriptions: play, pause, resume, stop, seek, 50–125% speed, loop; keys light up from what's sounding; the full duration plays, silences included (ADR 0013)
- **Notes library** of 27 songs: public-domain pieces (Für Elise and Moonlight Sonata with both hands, Canon in D, Bach's Prelude in C, Minuet in G, Ode to Joy, Mountain King, Korobeiniki, Greensleeves…), the original riffs (labelled "by ear"), and original exercises; search, categories, levels, favorites, curated picks with shuffle (labelled as hand-picked, not live chart data), a mini piano roll and transport
- Melody format: **triplets** (`/8t`) and **two-hand parts**
- **Touch**: multi-touch chords and glissando through one pointer handler with pointer capture (`PointerTracker`); `touch-action: none` on the keys only (ADR 0015)
- **On-screen octave controls** with the keyboard's range, and a **minimap** to move along the keyboard on narrow screens
- **Phone layout**: the keyboard docks to the bottom of the screen; on tall screens it stays pinned at the top; scroll-padding keeps focused content clear of it; safe-area insets
- Header links to Notes and Audio to Piano, and a **keyboard shortcuts dialog**
- **Sostenuto key** (`\`); hiding the tab releases notes and keyboard pedals
- **Playwright end-to-end tests** (desktop and phone): touch chords, glissando, no sideways scrolling at 8 widths, song playback, a full transcription scored against known notes; a CI job runs them
- Pitch tests for every key at every octave shift; 191 new unit tests (448 total)
- Docs: ADRs 0013–0015, walkthrough part 8, updated architecture and testing guides

#### Changed
- The function pages now sit below the keyboard, so large pages never push the keys off screen
- Branding is **FunKeys** throughout (header, fallboard wordmark)
- Minimum white key width 34 → 40 px; key height capped at 40% of the screen
- Songs play at their written pitch; the keyboard moves to show them, instead of transposing them to the keyboard
- `usePiano.noteOn` voices notes through the shared `voiceNote()`

#### Fixed
- Arrow keys on a focused range slider (tempo) also shifted the octave
- Segmented controls on the Sound page overflowed the screen on 320–360 px phones
- A swipe on the keys played a stray note before scrolling

#### Removed
- `Looper` and `useLooper` (replaced by the audio-clock `SequencePlayer`; ADR 0012 is superseded by ADR 0013) and `riffs.ts` (the riffs moved into the song library unchanged)

### The digital piano release: real-piano functions, a bigger keyboard and a redesigned interface

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
