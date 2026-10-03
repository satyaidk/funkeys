# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Documentation site in `docs/`: architecture, concept guides (Web Audio, music theory, React patterns), a five-part per-file code walkthrough, five Architecture Decision Records, testing and development guides, a roadmap and a portfolio guide
- Test suite: 76 unit and integration tests with Vitest + React Testing Library, and a fake Web Audio API for testing the engine
- GitHub Actions CI: lint, type-check, test and build on every push/PR to `dev` and `prod`
- `npm run typecheck`, `npm test`, `npm run test:watch` and `npm run validate` scripts
- `NowPlaying` component with animated chips, extracted from `PianoApp`
- Reduced-motion support via `MotionConfig reducedMotion="user"`
- Custom piano tab icon (`app/icon.svg`) and Open Graph metadata

### Changed
- Components organized by feature: `components/layout`, `components/piano`, `components/controls`
- `@types/node` upgraded to v24 to match the Node runtime (required by Vitest 5)

### Removed
- Unused create-next-app assets (`public/*.svg`, default `favicon.ico`)

## [0.1.0]

### Added
- Playable 17-key piano (C4–E5) mapped to the computer keyboard, with mouse and touch support
- Web Audio synthesis engine: 6 harmonic oscillators per note, ADSR envelope, low-pass filter, master compressor
- Controls: volume, octave shift (−2 to +2), sustain toggle, with keyboard shortcuts (Z / X / Space)
- Responsive keyboard that scales from 320px phones to desktop
- Animated UI with per-note rainbow colors and a soft glow for sustained notes

### Fixed
- Notes stuck on when replayed during their release fade
- Notes stuck on after a very quick first tap (async audio initialization)
- Notes stuck on when released with Shift held (`;` → `:`)
- Volume changes ignored before the first note
- Volume slider focus blocking keyboard play
- Ctrl+Z / Ctrl+X changing the octave instead of undo/cut
- Turning sustain off cutting notes that were still held
- Hovering over a key stopping a note held on the keyboard
