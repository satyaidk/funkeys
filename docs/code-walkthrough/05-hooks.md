# Part 5: Hooks (`src/hooks/`)

Hooks are the **bridge** between the plain-TypeScript core and the React UI: they own state, listen to events and call the engine. Patterns used here are explained in [React patterns](../concepts/react-patterns.md).

```
PianoApp
 ├─ useAudioEngine ─────┬──► usePiano ──► useKeyboardInput
 │                      └──► useMetronome
 ├─ useRecorder ◄───────────► usePiano   (capture ◄, playback ►)
 ├─ useLooper ──────────────► usePiano   (loops riffs from the Notes page)
 └─ useKeyboardLabels
```

| Hook | Responsibility |
| --- | --- |
| [`useAudioEngine`](#useaudioengine) | One engine per app; a stable `AudioControls` API |
| [`useKeyboardInput`](#usekeyboardinput) | Physical key presses → note on/off |
| [`useKeyboardLabels`](#usekeyboardlabels) | The user's real key labels (Keyboard Map API) |
| [`usePiano`](#usepiano) | Settings, notes, pedals, voice routing, shortcuts |
| [`useMetronome`](#usemetronome) | Tempo, beat lights, tap tempo |
| [`useRecorder`](#userecorder) | Record and replay performances |
| [`useLooper`](#uselooper) | Notes page: pick a riff, loop it, change its speed |

---

## `useAudioEngine`

### Purpose

Wraps the `AudioEngine` class in React's lifecycle and returns a **stable** `AudioControls` object.

### Code explained

```ts
export function useAudioEngine(): AudioControls {
  const engineRef = useRef<AudioEngine | null>(null);

  useEffect(() => () => { engineRef.current?.destroy(); engineRef.current = null; }, []);

  return useMemo<AudioControls>(() => {
    const engine = () => (engineRef.current ??= new AudioEngine());
    return {
      start: () => engine().init(),
      playNote: (id, frequency, options) => { const e = engine(); e.init(); e.playNote(id, frequency, options); },
      stopNote: (id) => engineRef.current?.stopNote(id),
      setReverb: (type, level) => engine().setReverb(type, level),
      getCurrentTime: () => engineRef.current?.currentTime ?? 0,
      …
    };
  }, []);
}
```

- `??=` (nullish assignment) creates the engine on first use. That's cheap: the AudioContext itself waits for `init()` inside a user gesture
- `useMemo(..., [])` keeps the **same object forever**, so `audio` is safe in dependency arrays
- `AudioControls` is an **interface**: `useMetronome.test.ts` passes a hand-made fake with a controllable clock

---

## `useKeyboardInput`

### Purpose

Listens on `window` and calls `onNoteStart(id)` / `onNoteStop(id)` for mapped keys.

### Code explained

```ts
const notesByCode = new Map(notes.map((note) => [note.code, note]));

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.defaultPrevented || isTypingTarget(e.target)) return;   // a control handled it / typing
  if (e.repeat) return;                                          // auto-repeat
  if (e.metaKey || e.ctrlKey || e.altKey) return;                // browser shortcuts
  if (pressedKeys.has(e.code)) return;
  const note = notesByCode.get(e.code);
  if (note) { e.preventDefault(); pressedKeys.set(e.code, note.id); onNoteStart(note.id); }
};

const handleKeyUp = (e: KeyboardEvent) => {
  const noteId = pressedKeys.get(e.code);   // the note THIS key started
  if (noteId) { pressedKeys.delete(e.code); onNoteStop(noteId); }
};
```

- Matching on **`e.code`** (physical key) means Shift, the soft pedal, can't change the note: Shift+2 is still `Digit2`
- A `Map` from key code to started note means the key-up always stops the right note, even after an octave change
- `blur` releases every held key, because the browser never sends keyup after Alt+Tab

---

## `useKeyboardLabels`

### Purpose

On AZERTY keyboards the key in the "Q" position is labelled "A". This hook asks the **Keyboard Map API** for each key's real label so the on-screen keys match what's printed on the user's keyboard.

```ts
useEffect(() => {
  const getLayoutMap = navigator.keyboard?.getLayoutMap;
  if (!getLayoutMap) return;                    // Firefox/Safari: keep QWERTY labels
  let cancelled = false;
  getLayoutMap.call(navigator.keyboard).then((layout) => { if (!cancelled) setLabels(…) }).catch(() => {});
  return () => { cancelled = true; };           // don't set state after unmount
}, []);
```

**Progressive enhancement:** better labels where supported, correct behavior everywhere. The `cancelled` flag is the standard guard against setting state after an effect has been cleaned up.

---

## `usePiano`

### Purpose

The **orchestrator**. One call gives the UI everything: notes, settings, pedals, held/ringing notes and actions.

### State

```ts
const [settings, setSettings] = useState<PianoSettings>(DEFAULT_SETTINGS);
const [pedals, setPedals] = useState<PedalState>(PEDALS_UP);
const [activeNoteIds, setActiveNoteIds] = useState<ReadonlySet<string>>(() => new Set());
const [sustainedNoteIds, setSustainedNoteIds] = useState<ReadonlySet<string>>(() => new Set());

const [tracker] = useState(() => new NoteTracker());   // stable instance
const settingsRef = useRef(settings);
const pedalsRef = useRef(pedals);
const pedalSourcesRef = useRef({ soft: new Set(), sostenuto: new Set(), sustain: new Set() });
```

Rule: **mutate refs / the tracker, then sync to state** ([ADR 0002](../decisions/0002-refs-plus-state-for-note-tracking.md)).

### Engine sync

```ts
useEffect(() => audio.setVolume(settings.volume), [audio, settings.volume]);
useEffect(() => audio.setReverb(settings.reverb, settings.reverbLevel), [audio, settings.reverb, settings.reverbLevel]);
useEffect(() => audio.setBrilliance(settings.brilliance), [audio, settings.brilliance]);
```

### Starting a note: the whole pipeline in one function

```ts
const noteOn = useCallback((noteId: string, rawVelocity = KEYBOARD_VELOCITY) => {
  const midi = noteIdToMidi(noteId);
  if (midi === null || !tracker.press(noteId)) return;       // invalid, or already held

  const s = settingsRef.current;
  const lowestKeyMidi = getMidiNumber('C', BASE_OCTAVE + s.octaveShift);
  audio.playNote(noteId, midiToFrequency(midi, s), {          // tuning
    voices: resolveVoices(s, midi - lowestKeyMidi),           // single / layer / split
    velocity: applyTouchCurve(rawVelocity, s.touch),          // touch curve
    midi: midi + s.transpose,
    soft: pedalsRef.current.soft,                             // una corda
  });
  onActionRef.current?.({ type: 'noteOn', noteId, velocity: rawVelocity });   // recorder
  syncNotes();
}, [audio, tracker, syncNotes]);
```

`noteOff` asks the tracker: `'stop'` → `audio.stopNote`; `'sustain'` → keep ringing; `'ignore'` → it wasn't held.

### Pedals with sources

```ts
const setPedal = useCallback((pedal, down, source = 'screen') => {
  const sources = pedalSourcesRef.current[pedal];
  const wasDown = sources.size > 0;
  down ? sources.add(source) : sources.delete(source);
  const isDown = sources.size > 0;
  if (wasDown === isDown) return;                 // nothing changed
  …tracker.setSustain(isDown) / setSostenuto(isDown) → audio.stopNote(each)
}, …);

const togglePedal = (pedal) => setPedal(pedal, !pedalSourcesRef.current[pedal].has('screen'), 'screen');
```

A pedal is down while **any** source (keyboard, screen, playback) holds it.

### Settings

```ts
const updateSettings = useCallback((patch: Partial<PianoSettings>) => {
  const previous = settingsRef.current;
  const next = sanitizeSettings({ ...previous, ...patch });
  if (next.octaveShift !== previous.octaveShift) releaseAll();   // no ghost notes
  settingsRef.current = next;
  setSettings(next);
}, [releaseAll]);
```

One entry point with validation, used by every control and shortcut.

### Shortcuts

A `window` listener maps `ArrowLeft/Right` → octave, `ArrowUp/Down` → transpose, `Space` → sustain (hold), `ShiftLeft/Right` → soft (hold). It skips events a control already handled (`defaultPrevented`) and lets a focused button keep Space.

### Return value

```ts
return { notes, settings, pedals, activeNoteIds, sustainedNoteIds,
         updateSettings, noteOn, noteOff, setPedal, togglePedal, releaseAll };
export type Performer = Pick<ReturnType<typeof usePiano>, 'noteOn' | 'noteOff' | 'setPedal' | 'releaseAll'>;
```

`Performer` is derived from the hook's own return type with `Pick`, so the recorder's contract stays in sync automatically.

### 🧪 Try it yourself

Give the sostenuto pedal a key: in the shortcut effect, map `Backslash` to `setPedal('sostenuto', …, 'keyboard')` on keydown/keyup, then add a test in `usePiano.test.tsx` modeled on the Space test.

---

## `useMetronome`

### Purpose

Owns tempo, time signature and click volume; drives a `MetronomeScheduler`; publishes the **current beat** for the lights.

```ts
onBeat: (beatIndex, time) => {
  // Light up when the click is heard, not when it was booked
  const delay = Math.max(0, (time - audio.getCurrentTime()) * 1000);
  const timer = setTimeout(() => { beatTimersRef.current.delete(timer); setBeat(beatIndex); }, delay);
  beatTimersRef.current.add(timer);
},
```

Clicks are booked up to 120 ms early, so the light waits for the gap. Timers are tracked in a `Set` so `stop()` and unmount can cancel them all. `tap()` keeps the last 8 tap times and uses `tempoFromTaps`.

---

## `useRecorder`

### Purpose

Records **performance events** (not audio) with timestamps, and plays them back through the piano.

```ts
const capture = useCallback((action) => {
  if (statusRef.current !== 'recording') return;
  eventsRef.current.push({ ...action, time: Date.now() - startedAtRef.current });
}, []);

const play = useCallback((performer: Performer) => {
  …
  timersRef.current = events.map((event) => setTimeout(() => {
    if (event.type === 'noteOn') performer.noteOn(event.noteId, event.velocity);
    else if (event.type === 'noteOff') performer.noteOff(event.noteId);
    else performer.setPedal(event.pedal, event.down, 'playback');
  }, event.time));
  timersRef.current.push(setTimeout(stop, end + 50));
}, [duration, stop]);
```

- The discriminated union (`event.type`) makes the dispatch type-safe
- Playback pedals use their own **source** (`'playback'`), so stopping playback lifts exactly what playback pressed
- `Date.now()` (not `performance.now()`) so Vitest's fake timers control time in tests

### 🧪 Try it yourself

Add **"Export as JSON"**: a button that downloads `eventsRef.current` as a file. Then add "Import" to load one back. That's the first step toward MIDI file export.

---

## `useLooper`

### Purpose

The state behind the **Notes** page: which riff is selected, the practice speed, and whether it's playing. It drives a `Looper` ([Part 2](./02-music.md#looperts)) that plays the riff on the piano.

```ts
const looper = useLooper({ audio, performer: piano, octaveShift: piano.settings.octaveShift });
looper.select('lean-on');   // switches straight away if a riff is playing
looper.setSpeed(0.5);       // restarts the loop at half tempo
looper.toggle();            // play / stop
```

### Code explained

```ts
// The looper's timers outlive renders, so they read the latest values from refs
useEffect(() => {
  performerRef.current = performer;
  octaveShiftRef.current = octaveShift;
}, [performer, octaveShift]);

looperRef.current ??= new Looper(
  { noteOn: (id) => performerRef.current.noteOn(id), noteOff: (id) => performerRef.current.noteOff(id) },
  (midi) => midiToNoteId(midi + 12 * octaveShiftRef.current)   // follow the octave shift
);
```

- **Created on first use, inside an event handler.** Building the `Looper` during render would hand it functions that read refs, which the React Compiler lint rule (`react-hooks/refs`) rejects, so it's made the first time you press Play (the same way `useMetronome` makes its scheduler).
- **Follows the octave shift** so the loop always lights keys you can see. It's read when each note starts, so shifting mid-loop moves the next note.
- **`audio.start()` in `start()`:** the first note plays from a timer, not from the click, and Safari only lets audio start inside the click itself.
- **`riffs` option:** the hook takes the library as an optional input (default `RIFFS`), so tests pass two tiny riffs with round numbers (120 BPM = 500 ms a beat).

### 🧪 Try it yourself

Show the looping riff on the LCD: pass `looper.playing` and `looper.riff.title` into `Display` and print "Loop: Tokyo Drift" next to the recorder status. Add a case to `Display.test.tsx`.
