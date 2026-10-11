# Part 6: Components (`src/components/`)

Components turn state into pixels. They receive data through props and report actions through callbacks. **No audio or keyboard logic lives here.**

```
components/
├── PianoApp.tsx              ← client root: creates hooks, lays out the cabinet
├── KeyGuide.tsx              ← legend of keys and shortcuts
├── console/
│   ├── ConsolePanel.tsx      ← container: volume knob, display, transport, tabs
│   ├── Display.tsx           ← dot-matrix LCD
│   ├── Transport.tsx         ← record / play / stop
│   ├── FunctionTabs.tsx      ← accessible tabs with LEDs
│   └── panels/               ← VoicePanel, LayerSplitPanel, SoundPanel, TuningPanel, MetronomePanel, NotesPanel
├── piano/
│   ├── Piano.tsx             ← fallboard, felt, cheeks, 37 keys
│   ├── PianoKey.tsx          ← one key
│   └── PedalUnit.tsx         ← three brass pedals
├── ui/                       ← design-system primitives
│   ├── PadButton.tsx, Led.tsx, Knob.tsx, SegmentedControl.tsx, RadioPads.tsx, Stepper.tsx, Field.tsx
└── layout/MotionProvider.tsx
```

Grouped **by feature** (console, piano) plus a shared **ui/** kit, the small design system the panels are built from.

Runtime tree:

```
RootLayout (server) → MotionProvider → Home (server)
  └── PianoApp
      ├── ConsolePanel ─ Knob · Display · Transport · FunctionTabs ─ [active panel]
      ├── Piano ─ PianoKey × 37
      ├── PedalUnit
      └── KeyGuide
```

---

## `ui/`: the design-system primitives

Every control on the panel is built from these. Each one handles its own accessibility.

### `PadButton` and `Led`

The raised rubber pad and its indicator light. Shared class strings (`PAD_BASE`, `PAD_IDLE`, `PAD_ACTIVE`) keep every pad consistent. `onMouseDown` calls `preventDefault()` so clicking doesn't take focus, which keeps Space as the sustain pedal ([React patterns §9](../concepts/react-patterns.md#mouse-clicks-dont-steal-focus)). `PadButtonProps extends ComponentProps<'button'>`, which includes `ref` in React 19.

### `Knob`

A rotary control (`role="slider"`):

```ts
const handlePointerDown = (e) => {
  e.preventDefault();
  e.currentTarget.setPointerCapture?.(e.pointerId);   // keep receiving moves outside the knob
  dragRef.current = { y: e.clientY, value };
};
const handlePointerMove = (e) => {
  const delta = ((drag.y - e.clientY) / DRAG_RANGE_PX) * (max - min);   // up = more
  onChange(snap(drag.value + delta));
};
```

Keyboard: arrows step, Page Up/Down ×10, Home/End jump. `snap()` rounds to the step and fixes floating-point noise. The value arc is an SVG path drawn with `arcPath(from, to)` (polar to Cartesian maths).

### `SegmentedControl` and `RadioPads`

Radio groups with **roving tabindex** (one Tab stop; arrows move selection and focus). The segmented highlight is a `motion.span` with a shared `layoutId`, so it slides between options. `RadioPads` shows LED + name + optional description, and is used for voices and temperaments.

### `Stepper`

−/value/+ with **press-and-hold repeat**:

```ts
onPointerDown={(e) => { onStep(); timerRef.current = setTimeout(repeat, REPEAT_DELAY_MS); }}
onPointerUp={stopRepeat}  onPointerLeave={stopRepeat}  onPointerCancel={stopRepeat}
onClick={(e) => { if (e.detail === 0) onStep(); }}   // keyboard activation only
```

`e.detail` is the click count: 0 means the click came from the keyboard (Enter/Space), so pointer and keyboard each step exactly once. Master tuning has 500 steps; holding sweeps through them.

### 🧪 Try it yourself

Make the knob respond to the **mouse wheel**. Add a native `wheel` listener in an effect with `{ passive: false }` so you can `preventDefault()` page scrolling. (React's `onWheel` is passive.)

---

## `piano/PianoKey.tsx`

One key, ivory or ebony.

| State | Look |
| --- | --- |
| Idle | Ivory gradient with a front lip / ebony with a highlight |
| Held (`isActive`) | Moves down, lit in the note's color, glowing |
| Ringing (`isSustained`) | Key up, soft glow and colored lip |

- **No input handlers of its own:** the keyboard (`Piano`) handles every pointer and finds the key under it through `data-note-id` (see [Part 8](./08-playback-and-transcription.md#touch-input-libpointer-trackerts-pianopianotsx-pianokeyboardminimaptsx))
- **Lit by playback too:** `isActive` is true for keys you hold *and* keys a song or transcription is sounding
- **Labels:** the computer key always; the note name on every C (like stickers on a practice keyboard) and on any lit key
- **Power-on sweep:** a CSS animation with `animationDelay: 300 + index × 24 ms`, a single rainbow pass on load, disabled for reduced motion
- `memo` + stable callbacks: one key press re-renders one key

---

## `piano/Piano.tsx`

The keyboard: walnut **cheeks**, a lacquered **fallboard** with the gold wordmark, red **felt**, then the keys.

```ts
notes.forEach((note, index) => {
  whiteBefore.push(whiteKeys.length);
  if (note.isBlack) blackKeys.push({ note, index, whiteKeysBefore: whiteKeys.length });
  else whiteKeys.push(note);
});
```

Black keys sit at `left: calc(var(--white-key-width) × whiteKeysBefore)` and shift left by half their width.

**Responsive sizing** with CSS variables ([ADR 0004](../decisions/0004-css-variables-for-responsive-keys.md), [ADR 0010](../decisions/0010-two-manual-37-key-layout.md), [ADR 0015](../decisions/0015-docked-keyboard-on-phones.md)):

```ts
'--white-key-width': `clamp(40px, calc((min(100vw, 1480px) - 9rem) / 22), 58px)`,
'--white-key-height': `clamp(120px, min(calc(var(--white-key-width) * 4.2), 40dvh), 224px)`,
```

Below 40 px per key the keys keep their size and the keyboard becomes a window onto all 37, moved with the **minimap** in the toolbar; it starts with the board's middle C at the left. Keys are at most 40% of the screen height, for landscape phones.

**Pointer input** lives here, on the keys' container: pointer capture, `elementFromPoint` on each move (glissando), `PointerTracker` per finger (chords), release on up/cancel/blur/hidden tab, `touch-action: none` on the keys only. A screen reader's "click" (`event.detail === 0`) plays a short note.

**Toolbar:** octave −/+ with the range (`OctaveControls`), the minimap when the keys don't fit, and whatever the app passes (All notes off).

**Split mode:** zone labels on the fallboard corners ("◂ Electric piano", "Concert grand ▸") and an amber marker dropping from the felt at the first right-hand key.

**Layout labels:** `labels?.get(note.code) ?? note.keyLabel`, the real key label if the browser provided one.

---

## `piano/PedalUnit.tsx`

Three brass pedals on a lyre. Each is a `<button aria-pressed>` that **latches** on click (a mouse can't hold a pedal and play at the same time). The tongue shape is a narrow-topped, round-toed span with a horizontal brass gradient (convex highlight); pressing animates `y` and `rotateX` with a spring and tightens the floor shadow.

---

## `console/Display.tsx`

The **dot-matrix LCD** (`font-lcd` = DotGothic16, amber text glow, a CSS pixel grid):

- Row 1: main voice; subtitle `+ String ensemble` (layer) or `Left hand: Electric piano` (split); tempo and beat dots
- Row 2: **status cells** (transpose, octave, A4, tuning) that are **bright when changed, dim at default**, plus the recorder state with a red LED
- Row 3: `♪ C4 E4 G4` (an `aria-live` region) and pedal indicators

"Dim at default" is a deliberate information design choice: you can see at a glance what's been changed.

## `console/Transport.tsx`

Round record/play/stop pads. Play is disabled until there's a take; the status line explains what to do ("Press record, then play"); a Delete link appears for a finished take.

## `console/FunctionTabs.tsx`

WAI-ARIA tabs (`tablist`/`tab`/`tabpanel`, `aria-controls`, arrow keys). Each tab has an **LED that lights when its page holds a non-default setting**. The amber underline slides with `layoutId`, and pages cross-fade with `AnimatePresence mode="wait"`. On wide screens the page area has a **fixed minimum height** so the keyboard never jumps between pages.

## `console/ConsolePanel.tsx` and `console/Workspace.tsx`

`ConsolePanel` is now just the top of the cabinet (volume, LCD, recorder); on phones the LCD comes first. The function pages moved below the keyboard into **`Workspace`**, the container that hands each page only what it needs and computes the tab LEDs (`tuningChanged`, `soundChanged`, a song or transcription playing). The LCD's "now playing" line includes notes sounding from playback.

## `console/panels/*`

| Panel | Controls |
| --- | --- |
| `VoicePanel` | 8 voice pads (`RadioPads`) |
| `LayerSplitPanel` | Mode segmented control; layer voice + balance knob, or left-hand voice + split-point stepper; animated swap between modes |
| `SoundPanel` | Reverb room + depth knob, brilliance, touch curve |
| `TuningPanel` | Transpose stepper, master tuning stepper (+ reset), temperament pads, temperament key stepper |
| `MetronomePanel` | Start/stop pad + beat lights, tempo stepper + slider + marking, time signature, tap, click volume |
| `NotesPanel` | The song library: search, category chips (`ChipGroup`), level, favorites, curated picks with Shuffle, song cards; the selected song with a mini piano roll (`NotePreview`) and the transport (`PlaybackBar`) |
| `transcription/AudioPanel` | Audio to Piano: drop zone with limits and privacy note, staged progress with Cancel, errors, then the result with `PlaybackBar`, `PianoRoll`, `NoteInspector`, undo/redo and exports |

Panels are **presentational**: props in, callbacks out.

---

## `PianoApp.tsx`

```tsx
const audio = useAudioEngine();
const recorder = useRecorder();
const piano = usePiano({ audio, onPerformanceAction: recorder.capture });
const metronome = useMetronome(audio);
const player = useSequencePlayer({ audio, settingsRef: piano.settingsRef, onStart: fitKeyboard });
const transcription = useTranscription(player);
```

Then lays out the page: `AppHeader`, `ConsolePanel`, the keyboard (pinned to the top of tall screens, **docked to the bottom on phones** with the `pin`/`dock` variants), `PedalUnit`, `Workspace`, `KeyGuide`, and the `ShortcutsDialog`. It measures the keyboard into `--keyboard-height` for `scroll-padding`.

## `layout/AppHeader.tsx` and `ShortcutsDialog.tsx`

The header links open the Notes and Audio to Piano pages (`FunctionTabs` can now be controlled from outside). The shortcuts dialog is a native `<dialog>` opened with `showModal()`: focus is trapped, Esc closes it, and key presses inside it don't reach the piano.

## `KeyGuide.tsx` and `layout/MotionProvider.tsx`

`KeyGuide` renders keycaps for both manuals (with the current note ranges) and the shortcuts. `MotionProvider` applies `reducedMotion="user"` app-wide, as a client component so `layout.tsx` can stay a Server Component.
