# React & Next.js patterns used in this project

The React patterns you'll see across the codebase, why each is used, and where to find it. If a hook in the code confuses you, look it up here.

---

## 1. Components and props

A component is a function that takes **props** (inputs) and returns UI. Data flows **down** through props; events flow **up** through callback props.

```tsx
// PianoApp passes data down…
<ControlPanel volume={config.volume} onVolumeChange={onVolumeChange} />

// …ControlPanel calls the callback to send events up
<input onChange={(e) => onVolumeChange(Number(e.target.value))} />
```

`ControlPanel` doesn't *own* the volume. It displays it and reports changes. This is a **controlled component**, and it keeps a single source of truth (in `usePiano`).

## 2. Custom hooks: logic without UI

A **custom hook** is a function starting with `use` that calls other hooks. It packages *behavior* so components stay simple.

| Hook | Responsibility |
| --- | --- |
| `useAudioEngine` | Owns the AudioEngine instance and its lifecycle |
| `useKeyboardInput` | Turns keyboard events into note start/stop calls |
| `usePiano` | Combines the two above, plus controls and visual state |

`PianoApp` just calls `usePiano()` and passes the results to components. **Components describe what things look like; hooks decide what happens.**

## 3. `useState`: values that change what's on screen

```ts
const [config, setConfig] = useState<PianoConfig>({ volume: 0.7, octaveShift: 0, sustain: false });
```

Calling `setConfig` schedules a re-render. Use state for anything the UI displays.

**Functional updates** use the previous value safely:

```ts
setConfig((prev) => ({ ...prev, volume: clamped }));
```

**Lazy initial state** (`useState(() => new Set())`) runs the initializer only once instead of creating a throwaway `Set` on every render.

## 4. `useRef`: values that *don't* change what's on screen

A ref is a box (`ref.current`) that survives re-renders, and **changing it does not re-render**.

Used for:

- `engineRef`: the AudioEngine instance (must persist, must not cause renders)
- `pressedKeysRef`: which physical keys are down (only event handlers need it)
- `pointerDownRef` in `PianoKey`: did *this* pointer press the key?
- `heldRef`, `sustainedRef`, `sustainRef` in `usePiano`: see below

### The stale closure problem, and why `usePiano` mirrors state in refs

Event handlers are closures: they "remember" the variables from the render they were created in. If a handler reads `state` and the state changed since, it may see an **old value**. Also, `setState` doesn't update the variable immediately; it updates it on the *next* render.

`usePiano` needs to answer "is C4 held right now?" *synchronously* inside handlers that fire in quick succession (key down, key up, octave change). So it keeps the truth in **refs** and copies it into **state** for rendering:

```ts
heldRef.current.add(noteId);   // instant, always current, used by logic
syncNoteState();               // copies refs → state, triggers re-render for UI
```

Full reasoning: [ADR 0002](../decisions/0002-refs-plus-state-for-note-tracking.md).

## 5. `useEffect`: syncing with the outside world

Effects run **after** render, to connect React to things outside it (window events, timers, audio). They return a **cleanup** function.

```ts
useEffect(() => {
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown); // cleanup
}, [handleKeyDown]);
```

The cleanup runs before the effect re-runs and when the component unmounts. **Forgetting cleanup causes duplicate listeners and memory leaks.** Every effect in this project cleans up after itself.

`useAudioEngine` uses an effect *only* for cleanup, closing the AudioContext on unmount:

```ts
useEffect(() => () => { engineRef.current?.destroy(); engineRef.current = null; }, []);
```

> 💡 In development, React's **Strict Mode** mounts components, unmounts them, and mounts them again to expose missing cleanups. That's why the ref is set back to `null`: the remount then gets a fresh engine instead of a closed one.

## 6. `useCallback` and `useMemo`: stable identities

Every render creates new function objects. Usually that's fine, but it matters when:

1. A function is a **dependency of an effect** (a new function means the effect re-runs, re-adding listeners)
2. A function is passed to a **memoized child** (a new function means the child re-renders anyway)

```ts
const handleNoteStop = useCallback((noteId: string) => { … }, [stopNote, syncNoteState]);
```

`useCallback` returns the **same** function until a dependency changes. `useMemo` does the same for computed values:

```ts
const notes = useMemo(() => generateNotes(config.octaveShift), [config.octaveShift]);
```

`notes` is only rebuilt when the octave changes, not on every key press.

## 7. `React.memo`: skip re-rendering unchanged components

```ts
const PianoKey = memo(function PianoKey(props) { … });
```

`memo` makes a component re-render **only if its props changed** (compared with `===`). Pressing C4 changes C4's `isActive`, so only C4 re-renders, not all 17 keys. This only works because the callbacks passed to it are stable (`useCallback`).

## 8. Derived state: compute, don't store

`NowPlaying` doesn't keep its own list of sounding notes. It **derives** it from props every render:

```ts
const soundingNotes = notes.filter((n) => activeNoteIds.has(n.id) || sustainedNoteIds.has(n.id));
```

Storing a copy would mean two sources of truth that can drift apart. **If you can compute it, don't store it.**

## 9. Server and Client Components (Next.js App Router)

- Files in `app/` are **Server Components** by default. They render to HTML on the server and ship no JavaScript.
- `'use client'` at the top of a file makes it (and everything it imports) a **Client Component**, which can use state, effects and browser APIs.
- Keep `'use client'` as low in the tree as possible. Here, `page.tsx` is a Server Component that renders the client island `<PianoApp />`.
- `layout.tsx` wraps children in `<MotionProvider>`, a tiny Client Component. A Server Component *can render* a Client Component and pass it children.

## 10. Next.js file conventions used

| File | Convention |
| --- | --- |
| `app/layout.tsx` | Root layout: wraps every page; must render `<html>` and `<body>` |
| `app/page.tsx` | The page for the `/` route |
| `app/icon.svg` | Automatically becomes the browser tab icon |
| `export const metadata` | Sets `<title>`, description, Open Graph tags |
| `export const viewport` | Sets theme color (browser UI tint on mobile) |
| `LayoutProps<'/'>` | Global type helper for layout props (no import needed) |
| `next/font/google` | Downloads fonts at build time and self-hosts them, with no layout shift |

## 11. Framer Motion basics

```tsx
<motion.button
  animate={{ y: isActive ? 4 : 0, scale: isActive ? 0.98 : 1 }}
  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
/>
```

- `motion.x` is an animatable version of any HTML element
- `animate` is the target; Motion animates to it whenever it changes
- `initial` is the starting state on mount (used for entrance animations)
- `AnimatePresence` + `exit` animate elements **as they're removed** (the glow bar, the "now playing" chips)
- `type: 'spring'` uses physics instead of a fixed duration, so presses feel snappy and natural
- `MotionConfig reducedMotion="user"` respects the OS accessibility setting app-wide
