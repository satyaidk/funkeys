# Keyboard Piano: Documentation

Welcome! These docs explain how the project works, from the big picture down to every file, and teach the concepts behind it along the way.

## 🧭 Suggested reading order

If you're new to the codebase (or to the concepts), read in this order:

| Step | Read | You'll learn |
| --- | --- | --- |
| 1 | Run the app (`npm run dev`) and play with it for 5 minutes | What it does, from a user's view |
| 2 | [Architecture](./architecture.md) | The layers, the data flow, where state lives |
| 3 | [Music theory for programmers](./concepts/music-theory.md) | Notes, octaves, the frequency formula |
| 4 | [Web Audio API](./concepts/web-audio.md) | Oscillators, harmonics, ADSR, autoplay policy |
| 5 | [React & Next.js patterns](./concepts/react-patterns.md) | The hooks and patterns used everywhere |
| 6 | [Code walkthrough](./code-walkthrough/) (parts 1 → 5) | Every file, line of reasoning by line of reasoning |
| 7 | [Architecture Decision Records](./decisions/) | *Why* key choices were made |
| 8 | [Testing](./testing.md) | How the 76 tests work, and how to write more |
| 9 | [Development guide](./development.md) | Git workflow, conventions, adding a feature, deploying |
| 10 | [Roadmap](./roadmap.md) | Features to build next, by difficulty |
| 11 | [Portfolio & interview guide](./portfolio-guide.md) | Resume bullets, interview stories, demo script |

## 📂 Map of the docs

```
docs/
├── README.md                ← you are here
├── architecture.md          ← system design overview
├── concepts/
│   ├── music-theory.md
│   ├── web-audio.md
│   └── react-patterns.md
├── code-walkthrough/
│   ├── README.md
│   ├── 01-types.md
│   ├── 02-lib.md
│   ├── 03-hooks.md
│   ├── 04-components.md
│   └── 05-app-and-config.md
├── decisions/               ← Architecture Decision Records
│   ├── README.md
│   └── 0001 … 0005
├── testing.md
├── development.md
├── roadmap.md
└── portfolio-guide.md
```

## 🔍 "Where is…?" quick lookup

| I want to understand… | Go to |
| --- | --- |
| How a key press becomes sound | [Architecture §6](./architecture.md#6-data-flow-what-happens-when-you-press-a-key) |
| How the piano tone is built | [Web Audio §4–5](./concepts/web-audio.md#4-harmonics-why-six-oscillators-per-note) |
| How black keys are positioned | [Components → Piano](./code-walkthrough/04-components.md#pianopianotsx) |
| Why some state is in refs | [ADR 0002](./decisions/0002-refs-plus-state-for-note-tracking.md) |
| How sustain works | [Hooks → usePiano](./code-walkthrough/03-hooks.md#usepianots) |
| How audio is tested without speakers | [Testing §6](./testing.md#6-testing-the-audio-engine-without-audio-the-fake-audiocontext) |
| Where to put new code | [Development §4](./development.md#where-new-code-goes) |

## ✍️ Keeping docs up to date

Docs are part of the code. When you change behavior:

- Update the matching section of the [code walkthrough](./code-walkthrough/)
- Add an [ADR](./decisions/) for any decision someone might later ask "why?" about
- Add a line to the [CHANGELOG](../CHANGELOG.md)
