# 🎹 Keyboard Piano

Play the piano with your computer keyboard, mouse, or touch screen. Sound is synthesized live with the Web Audio API, with no audio samples.

Built with Next.js (App Router), React, Tailwind CSS v4 and Framer Motion.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and press a key. Browsers only allow audio after you interact with the page, so the audio engine starts on your first key press or click.

## Controls

| Action                | Keys                          |
| --------------------- | ----------------------------- |
| White keys (C4 → E5)  | `A S D F G H J K L ;`         |
| Black keys            | `W E` · `T Y U` · `O P`       |
| Octave down / up      | `Z` / `X` (range −2 to +2)    |
| Toggle sustain pedal  | `Space`                       |

You can also click or tap the keys, drag the volume slider, and use the on-screen octave and sustain buttons.

With sustain on, released notes keep ringing (shown with a softer glow) until you turn sustain off.

## Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout, fonts, metadata
│   ├── page.tsx            # Page (Server Component)
│   └── globals.css         # Tailwind + theme
├── components/
│   ├── Header.tsx          # Animated title
│   ├── PianoApp.tsx        # Client root: wires usePiano to the UI
│   ├── ControlPanel.tsx    # Volume, octave, sustain controls
│   ├── Piano.tsx           # Keyboard layout (white + black keys)
│   └── PianoKey.tsx        # Single key with press/glow animation
├── hooks/
│   ├── usePiano.ts         # Orchestrates notes, input, audio and controls
│   ├── useAudioEngine.ts   # AudioEngine lifecycle in React
│   └── useKeyboardInput.ts # Computer keyboard → note events
├── lib/
│   ├── audio-engine.ts     # Web Audio synthesis (harmonics + ADSR)
│   ├── notes.ts            # Frequencies and key mapping
│   ├── constants.ts        # Tunable values
│   └── dom.ts              # DOM helpers
└── types/index.ts          # Shared TypeScript types
```

## Scripts

- `npm run dev`: start the dev server
- `npm run build`: production build
- `npm start`: serve the production build
- `npm run lint`: run ESLint
