# Keyboard Piano: Documentation

How the project works, from the big picture down to every file, and the concepts behind it.

## 🧭 Suggested reading order

| Step | Read | You'll learn |
| --- | --- | --- |
| 1 | Run the app (`npm run dev`) and play for 10 minutes | What it does, as a user |
| 2 | [Digital piano functions](./concepts/piano-functions.md) | What each feature does on a real piano |
| 3 | [Architecture](./architecture.md) | Layers, data flow, state, audio graph, design system |
| 4 | [Music theory for programmers](./concepts/music-theory.md) | Notes, MIDI, frequencies, the 37-key layout, temperaments |
| 5 | [Web Audio API](./concepts/web-audio.md) | Synthesis, envelopes, FM, reverb, scheduling |
| 6 | [React & Next.js patterns](./concepts/react-patterns.md) | The hooks and UI patterns used everywhere |
| 7 | [Code walkthrough](./code-walkthrough/) (parts 1 → 7) | Every file and the reasoning behind it |
| 8 | [Architecture Decision Records](./decisions/) | *Why* key choices were made |
| 9 | [Testing](./testing.md) | How the 220 tests work, and how to write more |
| 10 | [Development guide](./development.md) | Git workflow, conventions, adding features, deploying |
| 11 | [Roadmap](./roadmap.md) | Features to build next |
| 12 | [Portfolio & interview guide](./portfolio-guide.md) | Resume bullets, interview stories, demo script |

## 📂 Map

```
docs/
├── README.md                    ← you are here
├── architecture.md
├── concepts/
│   ├── piano-functions.md       ← real digital-piano features, with sources
│   ├── music-theory.md
│   ├── web-audio.md
│   └── react-patterns.md
├── code-walkthrough/
│   ├── README.md
│   ├── 01-types.md
│   ├── 02-music.md
│   ├── 03-audio.md
│   ├── 04-core-state.md
│   ├── 05-hooks.md
│   ├── 06-components.md
│   └── 07-app-and-config.md
├── decisions/                   ← 11 Architecture Decision Records
├── testing.md
├── development.md
├── roadmap.md
└── portfolio-guide.md
```

## 🔍 "Where is…?"

| I want to understand… | Go to |
| --- | --- |
| How a key press becomes sound | [Architecture §7](./architecture.md#7-data-flow-a-key-press-becomes-sound) |
| Which computer key plays which note | [Music theory §6](./concepts/music-theory.md#6-mapping-the-computer-keyboard-to-37-piano-keys) |
| How a voice is synthesized | [Audio walkthrough: synth-voice](./code-walkthrough/03-audio.md#synth-voicets) |
| How the pedals work | [Piano functions](./concepts/piano-functions.md#the-three-pedals), [note-tracker](./code-walkthrough/04-core-state.md#note-trackerts) |
| How temperaments are calculated | [Music theory §8](./concepts/music-theory.md#8-temperaments) |
| Why the metronome doesn't drift | [ADR 0007](./decisions/0007-lookahead-metronome-scheduler.md) |
| How the UI controls are built | [Components: ui/](./code-walkthrough/06-components.md#ui-the-design-system-primitives) |
| The visual design decisions | [ADR 0011](./decisions/0011-instrument-as-interface.md) |
| Where to put new code | [Development §4](./development.md#where-new-code-goes) |

## ✍️ Keeping docs current

Docs are part of the code. When behavior changes, update the matching [walkthrough](./code-walkthrough/) section, add an [ADR](./decisions/) for any decision someone might ask "why?" about, and add a line to the [CHANGELOG](../CHANGELOG.md).
