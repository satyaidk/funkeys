# React & Next.js patterns used in this project

The patterns you'll see across the codebase, why each is used, and where to find it. If a hook or component confuses you, look it up here.

---

## 1. Components and props

A component is a function that takes **props** and returns UI. Data flows **down** through props; events flow **up** through callback props.

```tsx
<VoicePanel voice={settings.voice} onChange={(voice) => updateSettings({ voice })} />
```

`VoicePanel` doesn't own the voice. It displays it and reports changes: a **controlled component** with a single source of truth (in `usePiano`).

### Container and presentational components

- **Containers** connect state to UI: `PianoApp` (creates the hooks) and `ConsolePanel` (hands each panel what it needs).
- **Presentational** components just render props: `Piano`, `PianoKey`, `Display`, every panel, every `ui/` primitive.

Presentational components are easy to test and reuse, because they don't know where data comes from.

## 2. Custom hooks: logic without UI

| Hook | Responsibility |
| --- | --- |
| `useAudioEngine` | Owns the AudioEngine; returns a stable `AudioControls` object |
| `useKeyboardInput` | Turns physical key presses into note on/off calls |
| `useKeyboardLabels` | Reads the user's keyboard layout labels (Keyboard Map API) |
| `usePiano` | The orchestrator: settings, notes, pedals, shortcuts |
| `useMetronome` | Tempo, time signature, beat lights, tap tempo |
| `useRecorder` | Records performance events and plays them back |

**Components describe what things look like; hooks decide what happens.**

### Dependency injection between hooks

`usePiano` doesn't create the audio engine. It **receives** it:

```tsx
const audio = useAudioEngine();
const recorder = useRecorder();
const piano = usePiano({ audio, onPerformanceAction: recorder.capture });
const metronome = useMetronome(audio);
```

The metronome and the piano share one engine, and tests can pass in a fake `audio` (see `useMetronome.test.ts`).

## 3. `useState`: values that change what's on screen

```ts
const [settings, setSettings] = useState<PianoSettings>(DEFAULT_SETTINGS);
```

Calling the setter schedules a re-render. **Lazy initialization** (`useState(() => new NoteTracker())`) creates the object once instead of on every render, which is also a neat way to hold a stable class instance.

## 4. `useRef`: values that *don't* change what's on screen

A ref is a box (`ref.current`) that survives re-renders; changing it does **not** re-render. Used for:

- `engineRef`: the AudioEngine instance
- `pressedKeysRef`: physical keys currently down → note id
- `pointerDownRef` (PianoKey): did *this* pointer press this key?
- `settingsRef`, `pedalsRef`, `pedalSourcesRef` (usePiano): latest values for event handlers
- `schedulerRef`, `beatTimersRef` (useMetronome), `timersRef` (useRecorder)

### Refs mirrored to state

Event handlers can fire faster than React re-renders, and handlers created in an older render see **stale** values. `usePiano` keeps the source of truth in refs (and the `NoteTracker`), then mirrors it into state for rendering:

```ts
settingsRef.current = next;   // handlers read this immediately
setSettings(next);            // the UI re-renders from this
```

Full reasoning: [ADR 0002](../decisions/0002-refs-plus-state-for-note-tracking.md).

## 5. `useEffect`: syncing with the outside world

Effects connect React to things outside it and **always clean up**:

```ts
useEffect(() => {
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [handleKeyDown]);
```

Effects are also the right tool to **push state into an external system**:

```ts
useEffect(() => audio.setReverb(settings.reverb, settings.reverbLevel), [audio, settings.reverb, settings.reverbLevel]);
```

Whenever reverb settings change, from a control or a test, the engine follows. No component has to remember to call it.

> 💡 React **Strict Mode** mounts, unmounts and remounts components in development to expose missing cleanups. `useAudioEngine` sets its ref back to `null` on unmount so the remount gets a fresh engine.

## 6. `useCallback`, `useMemo` and stable identities

New function objects are created on every render. That matters when a function is an **effect dependency** (it would re-run the effect) or a prop of a **memoized child** (it would re-render anyway).

```ts
const noteOn = useCallback((noteId, velocity) => { … }, [audio, tracker, syncNotes]);
const notes = useMemo(() => generateNotes(settings.octaveShift), [settings.octaveShift]);
```

`useAudioEngine` returns a whole **API object** from `useMemo(..., [])`, so `audio` never changes identity and is safe to list in dependency arrays.

## 7. `React.memo`

```ts
const PianoKey = memo(function PianoKey(props) { … });
```

Re-renders only when props change. With 37 keys, pressing one re-renders one. That only works because `noteOn`/`noteOff` are stable (`useCallback`).

## 8. Derived state: compute, don't store

The display's note list is derived each render, never stored:

```ts
const soundingNotes = notes.filter((n) => activeNoteIds.has(n.id) || sustainedNoteIds.has(n.id)).map((n) => n.id);
```

Same for the tab LEDs (`tuningChanged`, `soundChanged`). Storing copies would create two sources of truth that can drift.

## 9. Accessible widgets: roving tabindex

`SegmentedControl`, `RadioPads` and `FunctionTabs` follow the WAI-ARIA patterns for radio groups and tabs:

- The group has **one Tab stop** (`tabIndex={checked ? 0 : -1}`)
- **Arrow keys** move the selection and focus
- Roles and states: `role="radiogroup"` / `role="radio"` + `aria-checked`, `role="tablist"` / `role="tab"` + `aria-selected` + `aria-controls`

The `Knob` is a `role="slider"` with `aria-valuenow/min/max/valuetext`, and supports arrows, Page Up/Down, Home/End.

### Who gets the arrow keys?

Arrow keys are also global shortcuts (octave, transpose). A focused control that handles a key calls `e.preventDefault()`, and the global listeners skip events where `e.defaultPrevented` is true. React's handlers run on the document before `window` listeners, so the order is guaranteed.

### Mouse clicks don't steal focus

Pads call `preventDefault()` on `mousedown`, so clicking a control doesn't focus it. Otherwise the next Space press would "click" that button instead of pressing the sustain pedal. Keyboard Tab focus still works.

## 10. `ref` as a prop (React 19)

In React 19, function components receive `ref` as a normal prop. No `forwardRef` needed:

```tsx
interface PadButtonProps extends ComponentProps<'button'> { … }   // includes ref
<PadButton ref={(el) => { buttonsRef.current[i] = el; }} … />
```

## 11. Server and Client Components (Next.js App Router)

- Files in `app/` are **Server Components** by default and ship no JavaScript.
- `'use client'` marks a file (and its imports) as a **Client Component**.
- Here, `page.tsx` stays a Server Component and renders the client island `<PianoApp />`. `layout.tsx` wraps children in `<MotionProvider>`, a tiny client component.

## 12. Next.js conventions used

| File / export | Purpose |
| --- | --- |
| `app/layout.tsx` | Root layout: `<html>`, `<body>`, fonts |
| `app/page.tsx` | The `/` route |
| `app/icon.svg` | Browser tab icon |
| `export const metadata` | Title, description, Open Graph |
| `export const viewport` | Theme color |
| `LayoutProps<'/'>` | Global type helper (no import) |
| `next/font/google` | Self-hosted fonts with CSS variables (`Instrument Sans`, `DotGothic16`) |

## 13. Framer Motion

```tsx
<motion.button animate={{ y: isActive ? 4 : 0 }} transition={{ type: 'spring', stiffness: 600, damping: 32 }} />
```

- `animate`: the target state; Motion animates whenever it changes
- `layoutId`: a **shared layout animation**. The segmented control's highlight and the tab underline slide between options because each option renders an element with the same `layoutId`
- `AnimatePresence` + `exit`: animate elements as they leave. `mode="wait"` makes the next tab page enter after the previous one leaves (which is why tests use `await findBy…`)
- `MotionConfig reducedMotion="user"`: respects the OS "reduce motion" setting app-wide

**Motion with purpose.** Animations answer user actions (pressing keys and pedals, switching pages). The only unprompted motion is a single power-on sweep across the keys at load, done in CSS and disabled for reduced motion.
