# Part 4: Components (`src/components/`)

Components turn state into pixels. They receive data through props, render it, and report user actions through callback props. **They contain no audio or keyboard logic.** That lives in hooks.

```
components/
├── PianoApp.tsx          ← client root: calls usePiano(), wires everything
├── layout/
│   ├── Header.tsx        ← animated title
│   └── MotionProvider.tsx← app-wide animation settings
├── piano/
│   ├── Piano.tsx         ← lays out the keys
│   ├── PianoKey.tsx      ← one key: visuals + pointer input
│   └── NowPlaying.tsx    ← colored chips for sounding notes
└── controls/
    └── ControlPanel.tsx  ← volume, octave, sustain
```

Components are grouped **by feature** (piano, controls, layout) rather than by type. When you work on the keyboard, everything you need is in `piano/`.

The component tree at runtime:

```
RootLayout (server)
└── MotionProvider
    └── Home page (server)
        ├── Header
        └── PianoApp ── usePiano()
            ├── ControlPanel
            ├── NowPlaying
            └── Piano
                └── PianoKey × 17
```

---

## `piano/PianoKey.tsx`

### Purpose

Renders **one key**, white or black, with press animation and colored glow, and turns pointer (mouse/touch/pen) events into `onNoteStart` / `onNoteStop` calls.

### Code explained

#### Visual states

```ts
const isRinging = isSustained && !isActive;
```

| State | Look |
| --- | --- |
| Idle | White or dark gradient |
| `isActive` (held) | Moves down 3–4px, strong colored glow, solid bottom bar |
| `isRinging` (sustained, key up) | Not pressed, soft glow, dim bottom bar |

Colors come from `getNoteColor(note.name)`. Hex codes get an alpha suffix for transparency: `${color}66` is the color at 40% opacity (`0x66` = 102 ≈ 40% of 255).

#### Sizes from CSS variables

```ts
const WHITE_WIDTH = `var(--white-key-width, ${WHITE_KEY_WIDTH}px)`;
```

The key reads its size from a CSS variable set by `Piano`, with the constant as fallback. That's how the keyboard shrinks on phones ([ADR 0004](../decisions/0004-css-variables-for-responsive-keys.md)).

#### Pointer handling

```ts
const pointerDownRef = useRef(false);

const handlePointerDown = (e) => {
  if (e.button !== 0) return;      // primary button only (not right-click)
  e.preventDefault();              // no focus, no text selection
  pointerDownRef.current = true;
  onNoteStart(note.id);
};

const handlePointerRelease = () => {
  if (!pointerDownRef.current) return;  // this pointer never pressed the key
  pointerDownRef.current = false;
  onNoteStop(note.id);
};
```

`handlePointerRelease` is used for `onPointerUp`, `onPointerLeave` (dragging off the key) and `onPointerCancel` (the browser interrupted the touch).

**Why `pointerDownRef`?** Without it, if you held `A` on the keyboard and just *moved the mouse across* the C4 key, `pointerleave` fired and stopped your note. The ref tracks "did *this pointer* press me?". There's a regression test for this in `Piano.test.tsx`.

**Pointer events** unify mouse, touch and pen. One set of handlers covers all three.

#### Touch-friendly details

- `touch-none` (CSS `touch-action: none`) stops the page scrolling or zooming when you play
- `onContextMenu → preventDefault` stops long-press menus on phones
- `select-none` stops text highlighting on rapid clicks

#### Animation

```tsx
<motion.button
  animate={{ y: isActive ? 4 : 0, scale: isActive ? 0.98 : 1 }}
  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
/>
```

A stiff, well-damped spring: fast press, no wobble. The bottom glow bar is wrapped in `<AnimatePresence>` so it can **fade out** when removed.

#### Accessibility

- `aria-label="C#4"` gives screen readers a name (the visible text is just a key letter)
- `aria-pressed` announces held state
- `tabIndex={-1}` skips 17 piano keys in the Tab order, because the mapped computer keys already play every note

#### Memoization

```ts
const PianoKey = memo(function PianoKey(props) { … });
```

Only re-renders when its own props change. Press C4 and only C4 re-renders.

### 🧪 Try it yourself

Make held keys "squish" more: change `scale: isActive ? 0.98 : 1` to `0.94`, and `stiffness` to `300` for a bouncier spring.

---

## `piano/Piano.tsx`

### Purpose

Lays out the keyboard: white keys side by side, black keys positioned on top between them, plus the wooden frame and red felt strip.

### Code explained

#### Splitting keys and finding black-key positions

```ts
notes.forEach((note) => {
  if (note.isBlack) blackKeys.push({ note, whiteKeysBefore: whiteKeys.length });
  else whiteKeys.push(note);
});
```

Because notes are in piano order, when we reach a black key, `whiteKeys.length` is exactly how many white keys are to its left. C# comes after one white key (C), so it sits at the boundary after key 1:

```
left = whiteKeyWidth × whiteKeysBefore
C#: 1 × width  ─┐   D#: 2 × width ─┐
           ┌────┼──┬───────────────┼──┬────
           │ C  │  │  D            │  │ E
```

Then `PianoKey` shifts itself left by half its width (`marginLeft: calc(width / -2)`), so it's **centered** on that boundary. This is wrapped in `useMemo`, so it's recomputed only when `notes` changes.

#### Responsive sizing with CSS variables

```ts
'--white-key-width': `clamp(26px, calc((100vw - 4rem) / ${whiteKeys.length}), 60px)`,
'--white-key-height': `clamp(140px, calc(var(--white-key-width) * 3.33), 200px)`,
'--black-key-width':  `calc(var(--white-key-width) * 0.6)`,
'--black-key-height': `calc(var(--white-key-height) * 0.65)`,
```

`clamp(min, preferred, max)` picks the preferred value but never goes outside min/max. Here the preferred width is "the screen width (minus padding) divided by the number of white keys". On a laptop it hits the 60px max; on a 375px phone each key is ~31px, and the whole keyboard fits with no horizontal scroll. The browser does this math on resize, with zero JavaScript.

#### Stable keys across octave changes

```tsx
<PianoKey key={note.keyboardKey} … />
```

React's `key` uses the **computer key** ('a'), not the note id ('C4'). When you shift octave, C4 becomes C5, but it's still the same on-screen key, so React updates its label instead of destroying and recreating 17 buttons.

### 🧪 Try it yourself

Change `BLACK_KEY_HEIGHT_RATIO` in constants to `0.5`. Black keys get shorter and the layout still lines up, because everything derives from the same variables.

---

## `piano/NowPlaying.tsx`

### Purpose

Shows a colored chip for every sounding note ("C4 E4 G4"), solid for held notes and dimmer for sustained ones.

### Code explained

- **Derived data.** The list is computed from props each render (`notes.filter(...)`), never stored. Because `notes` is in piano order, chips are always sorted low → high.
- **Fixed height (`h-8`).** The row keeps its height when empty, so the keyboard below doesn't jump up and down as you play. Avoiding layout shift is a core UX principle.
- **`AnimatePresence` + `layout`.** Chips pop in and out, and the remaining chips slide smoothly into place.
- **`aria-live="polite"`.** Screen readers announce changes without interrupting.

---

## `controls/ControlPanel.tsx`

### Purpose

Three panels: a **volume** slider, **octave** −/+ buttons, and a **sustain** toggle. Each shows its keyboard shortcut.

### Code explained

#### Controlled inputs

```tsx
<input type="range" min={0} max={1} step={0.01} value={volume}
       onChange={(e) => onVolumeChange(Number(e.target.value))} />
```

The slider shows the `volume` prop and reports changes. It never stores its own value. `Number(...)` converts the string from the DOM into a number.

#### Class constants

```ts
const PANEL_CLASS = 'flex flex-col gap-2 rounded-xl border …';
```

Long Tailwind class strings repeated across panels are pulled into constants, so the three panels stay visually consistent and the JSX stays readable.

#### Preventing mouse focus

```ts
const preventMouseFocus = (e: React.MouseEvent) => e.preventDefault();
<button onMouseDown={preventMouseFocus} onClick={…}>
```

Why? If clicking "Octave +" left focus on that button, the next **Space** press would click "Octave +" again instead of toggling sustain. `preventDefault` on `mousedown` stops the focus change, and `click` still fires. Keyboard (Tab) focus still works for accessibility.

#### Accessibility

- `<label htmlFor="volume">` connects the label to the slider
- `aria-valuetext="70%"` makes screen readers say "70 percent", not "0.7"
- `disabled` at the octave limits, and `aria-pressed` on the sustain toggle
- `aria-keyshortcuts` advertises the shortcut keys
- `<output aria-live="polite">` announces the octave change
- `focus-visible:outline-*` shows focus rings for keyboard users only

#### Responsive grid

`grid-cols-2 sm:grid-cols-3`, and volume is `col-span-2 sm:col-span-1`. On phones, volume spans the full width with octave and sustain side by side below it. On larger screens there are three equal columns.

---

## `PianoApp.tsx`

### Purpose

The **client root** of the interactive app. It calls `usePiano()` once and passes the results down.

```tsx
const { notes, activeNoteIds, sustainedNoteIds, config, onNoteStart, … } = usePiano();
return (
  <motion.main …>
    <ControlPanel … />
    <NowPlaying … />
    <Piano … />
    <p>…help text…</p>
  </motion.main>
);
```

It's almost pure wiring, and that's the goal. This is sometimes called a **container component**: it connects state to **presentational components** (`Piano`, `ControlPanel`, `NowPlaying`) that just render props.

---

## `layout/Header.tsx`

The animated title. It fades and slides in on load (`initial` → `animate`).

One detail: the 🎹 emoji is in its **own** `<span aria-hidden="true">` outside the gradient text. Gradient text works by making text transparent and showing a background through it (`bg-clip-text text-transparent`), which would make the emoji invisible. `aria-hidden` stops screen readers saying "musical keyboard" before the title.

---

## `layout/MotionProvider.tsx`

```tsx
'use client';
export default function MotionProvider({ children }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
```

Applies one Framer Motion setting to the whole app: if the user has turned on **"reduce motion"** in their operating system, movement animations are skipped (fades still play). It's a separate Client Component so `layout.tsx` can remain a Server Component. This is the standard pattern for using client-only providers in the App Router.
