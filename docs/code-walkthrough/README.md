# Code walkthrough

A file-by-file explanation of the whole codebase. Read it **in order**: each part builds on the one before, from the foundation (types) up to the screen (components and app).

| # | Part | Files covered |
| --- | --- | --- |
| 1 | [Types](./01-types.md) | `src/types/index.ts` |
| 2 | [Core library](./02-lib.md) | `src/lib/constants.ts`, `notes.ts`, `audio-engine.ts`, `dom.ts` |
| 3 | [Hooks](./03-hooks.md) | `src/hooks/useAudioEngine.ts`, `useKeyboardInput.ts`, `usePiano.ts` |
| 4 | [Components](./04-components.md) | `src/components/**` (`PianoKey`, `Piano`, `NowPlaying`, `ControlPanel`, `PianoApp`, `Header`, `MotionProvider`) |
| 5 | [App shell & config](./05-app-and-config.md) | `src/app/**`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `vitest.config.mts`, `package.json`, CI |

Tests (`*.test.ts(x)`, `src/test/**`) are covered in [Testing](../testing.md).

## How to read a file

Every section follows the same pattern:

1. **Purpose**: what the file is for, in one or two sentences
2. **Where it fits**: who uses it and what it uses
3. **Code explained**: the important parts, with snippets
4. **Why it's built this way**: the design reasoning (the part interviewers care about)
5. **🧪 Try it yourself**: a small change to make so you learn by doing

> **Tip:** keep the actual source file open next to the doc. The docs explain *why*; the code comments explain *what*.
