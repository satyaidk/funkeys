# Code walkthrough

A file-by-file explanation of the whole codebase. Read it **in order**: each part builds on the one before, from the foundation (types and music math) up to the screen.

| # | Part | Files |
| --- | --- | --- |
| 1 | [Types](./01-types.md) | `types/index.ts` |
| 2 | [Music](./02-music.md) | `lib/music/notes.ts`, `keyboard-map.ts`, `tuning.ts` |
| 3 | [Audio](./03-audio.md) | `lib/audio/voices.ts`, `dynamics.ts`, `effects.ts`, `synth-voice.ts`, `audio-engine.ts`, `metronome.ts` |
| 4 | [Core state](./04-core-state.md) | `lib/note-tracker.ts`, `settings.ts`, `constants.ts`, `dom.ts` |
| 5 | [Hooks](./05-hooks.md) | `hooks/useAudioEngine.ts`, `useKeyboardInput.ts`, `useKeyboardLabels.ts`, `usePiano.ts`, `useMetronome.ts`, `useRecorder.ts` |
| 6 | [Components](./06-components.md) | `components/**`: piano, console, panels, ui primitives |
| 7 | [App shell & config](./07-app-and-config.md) | `app/**`, `next.config.ts`, `tsconfig.json`, ESLint, Vitest, CI |

Tests (`*.test.ts(x)`, `src/test/`) are covered in [Testing](../testing.md).

## How each section is laid out

1. **Purpose**: what the file is for
2. **Where it fits**: who uses it, what it uses
3. **Code explained**: the important parts, with snippets
4. **Why it's built this way**: the design reasoning (what interviewers ask about)
5. **🧪 Try it yourself**: a small change to learn by doing

> **Tip:** keep the source file open next to the doc. The docs explain *why*; code comments explain *what*.
