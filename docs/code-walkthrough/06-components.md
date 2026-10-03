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
│   └── panels/               ← VoicePanel, LayerSplitPanel, SoundPanel, TuningPanel, MetronomePanel
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

- **Velocity from position:** `velocityFromPosition((clientY - rect.top) / rect.height)`
- **`pointerDownRef`**: only *this pointer's* press can be released by `pointerleave` (regression test: hovering past a keyboard-held key mustn't stop it)
- **`touch-pan-x`** (`touch-action: pan-x`): on phones a sideways swipe scrolls the keyboard; the browser then fires `pointercancel`, which releases the note
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

**Responsive sizing** with CSS variables ([ADR 0004](../decisions/0004-css-variables-for-responsive-keys.md), [ADR 0010](../decisions/0010-two-manual-37-key-layout.md)):

```ts
'--white-key-width': `clamp(34px, calc((min(100vw, 1480px) - 9rem) / 22), 58px)`,
'--white-key-height': `clamp(168px, calc(var(--white-key-width) * 3.85), 224px)`,
```

Below 34px per key the keyboard **scrolls** instead of shrinking, and starts scrolled to the middle (`scrollLeft = (scrollWidth − clientWidth) / 2`).

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

## `console/ConsolePanel.tsx`

The **container**: receives the `piano`, `metronome` and `recorder` controllers and passes each panel only what it needs. Computes derived values: `soundingNotes`, `tuningChanged` and `soundChanged` (for the tab LEDs).

## `console/panels/*`

| Panel | Controls |
| --- | --- |
| `VoicePanel` | 8 voice pads (`RadioPads`) |
| `LayerSplitPanel` | Mode segmented control; layer voice + balance knob, or left-hand voice + split-point stepper; animated swap between modes |
| `SoundPanel` | Reverb room + depth knob, brilliance, touch curve |
| `TuningPanel` | Transpose stepper, master tuning stepper (+ reset), temperament pads, temperament key stepper |
| `MetronomePanel` | Start/stop pad + beat lights, tempo stepper + slider + marking, time signature, tap, click volume |

Panels are **presentational**: props in, callbacks out.

---

## `PianoApp.tsx`

```tsx
const audio = useAudioEngine();
const recorder = useRecorder();
const piano = usePiano({ audio, onPerformanceAction: recorder.capture });
const metronome = useMetronome(audio);
const labels = useKeyboardLabels();
```

Then lays out the **cabinet**: `ConsolePanel` on top, `Piano` below, `PedalUnit` under the cabinet, `KeyGuide` at the bottom.

## `KeyGuide.tsx` and `layout/MotionProvider.tsx`

`KeyGuide` renders keycaps for both manuals (with the current note ranges) and the shortcuts. `MotionProvider` applies `reducedMotion="user"` app-wide, as a client component so `layout.tsx` can stay a Server Component.
