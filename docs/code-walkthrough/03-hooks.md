# Part 3: Hooks (`src/hooks/`)

Hooks are the **bridge** between the plain-TypeScript core (`lib/`) and the React UI (`components/`). They own state, listen to events and call the audio engine. If React hooks are new to you, skim [React patterns](../concepts/react-patterns.md) first.

```
usePiano  ──uses──►  useAudioEngine  ──►  AudioEngine (lib)
    │
    └──uses──►  useKeyboardInput  ──►  window keyboard events
```

| File | Responsibility |
| --- | --- |
| [`useAudioEngine.ts`](#useaudioenginets) | Owns one `AudioEngine` across renders; exposes stable functions |
| [`useKeyboardInput.ts`](#usekeyboardinputts) | Converts key presses into note start/stop calls |
| [`usePiano.ts`](#usepianots) | The "brain": notes, held/sustained tracking, controls, shortcuts |

---

## `useAudioEngine.ts`

### Purpose

Wraps the `AudioEngine` class in React's lifecycle: create it lazily, keep it across re-renders, and close it on unmount.

### Code explained

```ts
const engineRef = useRef<AudioEngine | null>(null);
const volumeRef = useRef(DEFAULT_VOLUME);
```

- `engineRef` holds the engine. A **ref**, not state, because creating or changing it should never re-render the UI.
- `volumeRef` remembers the last volume so a re-created engine starts at the right level.

```ts
const getEngine = useCallback(() => {
  if (!engineRef.current) {
    engineRef.current = new AudioEngine();
    engineRef.current.setVolume(volumeRef.current);
  }
  return engineRef.current;
}, []);
```

**Lazy creation.** The engine object is created on first use. That's cheap: the actual `AudioContext` is only created by `engine.init()`, which runs inside `playNote`, during a user gesture, satisfying the autoplay policy.

```ts
const playNote = useCallback((noteId, frequency) => {
  const engine = getEngine();
  engine.init();
  engine.playNote(noteId, frequency);
}, [getEngine]);
```

`stopNote` and `stopAllNotes` use `engineRef.current?.` (optional chaining). If no note was ever played, there's nothing to stop, so they do nothing.

```ts
useEffect(() => () => {
  engineRef.current?.destroy();
  engineRef.current = null;
}, []);
```

An effect with **only a cleanup**. On unmount it closes the audio context. Resetting the ref to `null` matters in development, where React Strict Mode unmounts and remounts components: the remount gets a fresh engine instead of a dead one.

### Why it's built this way

- All returned functions are wrapped in `useCallback`, so their identity is **stable**. `usePiano` lists them as effect dependencies, and unstable functions would re-register listeners on every render.
- The hook is the *only* place that knows an `AudioEngine` exists. Swapping in a sample-based engine later means changing this one file.

### 🧪 Try it yourself

Add `console.log('engine created')` inside the `if` in `getEngine`. Load the page: nothing logs until you press a key. That's lazy initialization in action.

---

## `useKeyboardInput.ts`

### Purpose

Listens to `keydown`/`keyup` on `window` and calls `onNoteStart`/`onNoteStop` for keys that map to notes, while handling real-world edge cases.

### Code explained

#### Two identifiers per key press

A `KeyboardEvent` has two properties that sound similar:

| Property | Meaning | Example: press `;` | …with Shift held |
| --- | --- | --- | --- |
| `event.key` | The **character** produced | `";"` | `":"` |
| `event.code` | The **physical key** | `"Semicolon"` | `"Semicolon"` |

The hook uses **both**:

- `key` to find which note to play (`findNoteByKey(e.key)`)
- `code` to remember *which physical key* started *which note*

```ts
const pressedKeysRef = useRef<Map<string, string>>(new Map());  // physical key → noteId
```

#### Key down

```ts
if (isTypingTarget(e.target)) return;          // typing in a text field
if (e.repeat) return;                          // OS auto-repeat while held
if (e.metaKey || e.ctrlKey || e.altKey) return; // browser shortcuts
if (pressedKeys.has(physicalKey)) return;      // already down

const note = findNoteByKey(e.key);
if (note) {
  e.preventDefault();
  pressedKeys.set(physicalKey, note.id);       // remember: Semicolon → E5
  onNoteStart(note.id, note.frequency);
}
```

These **guard clauses** (early `return`s) handle each special case at the top, keeping the main logic flat and readable.

#### Key up

```ts
const noteId = pressedKeys.get(physicalKey);   // which note did THIS key start?
if (noteId) { pressedKeys.delete(physicalKey); onNoteStop(noteId); }
```

By stopping **the note this key started**, rather than looking the note up again, two bugs disappear:

1. **Shift bug.** Press `;`, hold Shift, release: `key` is `":"`, which maps to nothing. Looking it up would leave E5 stuck forever. `code` is still `"Semicolon"`, so the right note stops.
2. **Octave bug.** Hold `A` (C4), press `X` (octave up), release `A`. A fresh lookup would find **C5** and stop the wrong note. The map says C4.

See [ADR 0003](../decisions/0003-track-physical-keys-with-event-code.md).

#### Window blur

```ts
const handleBlur = () => {
  pressedKeys.forEach((noteId) => onNoteStop(noteId));
  pressedKeys.clear();
};
```

If you Alt+Tab away while holding a key, the browser never sends the `keyup`. On `blur` we release everything, so no stuck notes.

#### Effect setup and cleanup

All three listeners are added in one `useEffect` and removed in its cleanup. The effect re-runs when `notes` (via `findNoteByKey`), `onNoteStart` or `onNoteStop` change, so handlers always use current values.

### Why it's built this way

The hook knows nothing about audio or visuals. It only translates **keys → note ids** and calls the callbacks. That makes it reusable (you could drive a different instrument with it) and testable by dispatching fake keyboard events.

### 🧪 Try it yourself

Add `console.log(e.key, e.code)` at the top of `handleKeyDown`. Press keys with and without Shift and watch how `key` changes but `code` doesn't.

---

## `usePiano.ts`

### Purpose

The **orchestrator**. It's the one hook `PianoApp` calls, and it returns everything the UI needs: the notes, which are held or sustained, the settings, and handler functions.

### Code explained

#### State

```ts
const [config, setConfig] = useState<PianoConfig>({ volume, octaveShift: 0, sustain: false });
const [activeNoteIds, setActiveNoteIds] = useState<Set<string>>(() => new Set());
const [sustainedNoteIds, setSustainedNoteIds] = useState<Set<string>>(() => new Set());

const heldRef = useRef<Set<string>>(new Set());
const sustainedRef = useRef<Set<string>>(new Set());
const sustainRef = useRef(false);
```

The note sets exist **twice**: as refs (the source of truth used by logic) and as state (a copy used for rendering). `syncNoteState()` copies refs → state:

```ts
const syncNoteState = useCallback(() => {
  setActiveNoteIds(new Set(heldRef.current));       // new Set → new identity → React re-renders
  setSustainedNoteIds(new Set(sustainedRef.current));
}, []);
```

Why `new Set(...)`? React decides whether to re-render by comparing identities (`===`). Mutating the same `Set` would look unchanged. A copy is a new object. Full reasoning: [ADR 0002](../decisions/0002-refs-plus-state-for-note-tracking.md).

#### Derived notes

```ts
const notes = useMemo(() => generateNotes(config.octaveShift), [config.octaveShift]);
```

Recomputed only when the octave changes.

#### Starting a note

```ts
const handleNoteStart = useCallback((noteId, frequency) => {
  if (heldRef.current.has(noteId)) return;   // already held by another input
  playNote(noteId, frequency);
  heldRef.current.add(noteId);
  sustainedRef.current.delete(noteId);       // re-pressing a sustained note makes it "held" again
  syncNoteState();
}, [playNote, syncNoteState]);
```

#### Stopping a note

```ts
const handleNoteStop = useCallback((noteId) => {
  if (!heldRef.current.delete(noteId)) return;  // wasn't held → ignore
  if (sustainRef.current) sustainedRef.current.add(noteId);  // keep ringing
  else stopNote(noteId);                                      // fade out
  syncNoteState();
}, [stopNote, syncNoteState]);
```

`Set.delete()` returns `true` only if the item was there, so one line both removes the note and checks it was held. This guard ignores a stale key-up after an octave change already silenced everything.

#### Controls

| Handler | Behavior |
| --- | --- |
| `handleVolumeChange(v)` | Clamps to 0–1, updates `config` and the engine |
| `handleOctaveChange(shift)` | Clamps to −2…+2; if it changed, silences everything (`releaseAllNotes`) and updates `config` |
| `handleSustainToggle()` | Flips `sustainRef`. When turning **off**: fades out sustained notes but **leaves held notes playing** |

The sustain fix is subtle. The original implementation called `stopAllNotes()`, which cut off keys you were still holding. A real sustain pedal only releases notes whose keys are already up.

#### Keyboard shortcuts

A second `keydown` listener handles `Z` / `X` / `Space`, with the same guards (`isTypingTarget`, no modifiers). Notable details:

- **Ctrl+Z / Ctrl+X are ignored**, so undo and cut still work
- **Space** calls `preventDefault()` even on auto-repeat (stops the page scrolling) but only toggles once per press
- **Space on a focused `<button>`** is left alone, so keyboard users can activate buttons normally

#### Mouse / touch adapters

`PianoKey` only knows a note's id, so `handleMouseNoteStart(noteId)` looks up the frequency and calls `handleNoteStart`. Mouse and keyboard share **one code path**.

#### Return value

```ts
return { notes, activeNoteIds, sustainedNoteIds, config,
         onNoteStart, onNoteStop, onVolumeChange, onOctaveChange, onSustainToggle };
```

The hook's **public API**. Components never see refs, the engine, or event listeners.

### Why it's built this way

`usePiano` is a **facade**: one simple interface over several moving parts. `PianoApp` stays tiny and declarative, and all behavior is testable through `renderHook` without rendering a pixel (see `usePiano.test.tsx`).

### 🧪 Try it yourself

Make sustain work like a real pedal: **hold Space to sustain, release to stop**. Hints:

1. In the shortcut effect, call a "sustain on" function on Space `keydown` (when not repeating)
2. Add a `keyup` listener that calls "sustain off" for Space
3. Update the `toggles with Space` test in `usePiano.test.tsx` to match the new behavior
