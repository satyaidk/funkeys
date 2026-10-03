# 🎹 Keyboard Piano

[![CI](https://github.com/satyaidk/expert-eureka/actions/workflows/ci.yml/badge.svg)](https://github.com/satyaidk/expert-eureka/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![Tests](https://img.shields.io/badge/tests-76%20passing-brightgreen?logo=vitest&logoColor=white)

Play the piano with your computer keyboard, mouse, or touch screen. **Every note is synthesized live in the browser** with the Web Audio API. There are no audio files.

<!-- Add after deploying:  🔗 **Live demo:** https://your-app.vercel.app  -->
<!-- Add a GIF of playing a chord here: ![Demo](docs/assets/demo.gif) -->

## ✨ Features

- **17 playable keys** (C4–E5) mapped to your keyboard, plus mouse and multi-touch
- **Real-time synthesis:** 6 harmonic oscillators per note, ADSR envelope, low-pass filter and a master compressor
- **Octave shift** (−2 to +2) and **sustain pedal**, with on-screen controls and shortcuts
- **Rainbow visuals:** each note has its own color; sustained notes keep a soft glow
- **Responsive:** the keyboard scales from 320px phones to desktop with pure CSS
- **Accessible:** ARIA labels and live regions, keyboard-operable controls, respects "reduce motion"
- **Tested:** 76 unit and integration tests, CI on every push

## 🚀 Getting started

Requires **Node.js 22.12+**.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and press a key. Browsers only allow audio after you interact with the page, so the audio engine starts on your first key press or click.

## 🎮 Controls

| Action | Keys |
| --- | --- |
| White keys (C4 → E5) | `A S D F G H J K L ;` |
| Black keys | `W E` · `T Y U` · `O P` |
| Octave down / up | `Z` / `X` |
| Toggle sustain pedal | `Space` |

## 🏗 Architecture

```
UI components  ──►  custom hooks  ──►  core library (no React)  ──►  Web Audio API
(src/components)    (src/hooks)        (src/lib)
```

Each layer only depends on the one below it, so the audio engine can be tested and replaced independently of the UI. Read the full [architecture guide](docs/architecture.md).

## 🛠 Tech stack

**Next.js 16** (App Router) · **React 19** · **TypeScript** (strict) · **Tailwind CSS 4** · **Framer Motion** · **Web Audio API** · **Vitest** + **React Testing Library** · **GitHub Actions**

## 📁 Project structure

```
src/
├── app/                    # Next.js route, layout, global styles, icon
├── components/
│   ├── PianoApp.tsx        # Client root: wires usePiano() to the UI
│   ├── layout/             # Header, MotionProvider
│   ├── piano/              # Piano, PianoKey, NowPlaying
│   └── controls/           # ControlPanel
├── hooks/                  # usePiano, useAudioEngine, useKeyboardInput
├── lib/                    # audio-engine, notes, constants, dom
├── test/                   # Test setup + fake Web Audio API
└── types/                  # Shared TypeScript types
docs/                       # Architecture, concepts, code walkthrough, ADRs
```

## 📜 Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript type check |
| `npm test` | Run all tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run validate` | Lint + typecheck + test + build (same as CI) |

## 📚 Documentation

Full documentation lives in [`docs/`](docs/README.md):

- [Architecture](docs/architecture.md): layers, data flow, state, audio graph
- Concepts: [Web Audio](docs/concepts/web-audio.md) · [Music theory](docs/concepts/music-theory.md) · [React patterns](docs/concepts/react-patterns.md)
- [Code walkthrough](docs/code-walkthrough/): every file explained
- [Architecture Decision Records](docs/decisions/): why key choices were made
- [Testing](docs/testing.md) · [Development guide](docs/development.md) · [Roadmap](docs/roadmap.md)

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md).
