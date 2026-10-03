# Part 4: Core state (`src/lib/`)

Small, pure modules for the rules of the instrument: which notes keep sounding, which settings are valid, every tunable number, and one DOM helper.

| File | Responsibility |
| --- | --- |
| [`note-tracker.ts`](#note-trackerts) | Held vs. ringing notes; sustain and sostenuto rules |
| [`settings.ts`](#settingsts) | Default settings and validation |
| [`constants.ts`](#constantsts) | Every magic number, named and documented |
| [`dom.ts`](#domts) | "Is the user typing in a text field?" |

---

## `note-tracker.ts`

### Purpose

A **pure state machine** for keys and the two duration pedals. It never touches audio: each method returns *what should happen* ("stop these notes"), and the caller does it.

### Code explained

```ts
export class NoteTracker {
  private held = new Set<string>();       // keys down
  private ringing = new Set<string>();    // keys up, held by a pedal
  private captured = new Set<string>();   // caught by sostenuto
  private sustainDown = false;
  private sostenutoDown = false;

  press(noteId): boolean                  // false if already held
  release(noteId): 'stop' | 'sustain' | 'ignore'
  setSustain(down): string[]              // notes to stop
  setSostenuto(down): string[]            // notes to stop
  clearNotes(): void
}
```

The heart of it:

```ts
private isPedalHolding(noteId: string): boolean {
  return this.sustainDown || (this.sostenutoDown && this.captured.has(noteId));
}

setSostenuto(down: boolean): string[] {
  if (down && !this.sostenutoDown) {
    // Catch every note whose damper is up right now
    this.captured = new Set([...this.held, ...(this.sustainDown ? this.ringing : [])]);
  }
  …
}
```

- **Sustain** keeps every released note ringing; lifting it stops all ringing notes not otherwise held
- **Sostenuto** catches the notes held at that instant, *and* notes the sustain pedal is holding (how a real grand behaves). Notes played afterwards act normally
- Lifting either pedal only stops notes **no pedal** still holds; keys still down are never cut

### Why it's built this way

Pedal interactions have tricky combinations (sustain + sostenuto, pressed in either order). As a pure class they're covered by 11 fast unit tests, with no React or audio involved ([ADR 0008](../decisions/0008-pedal-logic-as-a-pure-state-machine.md)).

### 🧪 Try it yourself

Write a test: press C3, press sostenuto, press sustain, release C3, **lift sustain**. Should C3 stop? (No, sostenuto still holds it.) Then lift sostenuto: now it stops. Run it with `npx vitest run note-tracker`.

---

## `settings.ts`

### Purpose

The **defaults** for every setting, and **`sanitizeSettings`**, the single gatekeeper that clamps every value.

### Code explained

```ts
export function sanitizeSettings(settings: PianoSettings): PianoSettings {
  return {
    ...settings,
    volume: clamp(settings.volume, 0, 1),
    octaveShift: clamp(Math.round(settings.octaveShift), MIN_OCTAVE_SHIFT, MAX_OCTAVE_SHIFT),
    transpose: clamp(Math.round(settings.transpose), -MAX_TRANSPOSE, MAX_TRANSPOSE),
    referencePitch: clamp(Number((Math.round(p / 0.1) * 0.1).toFixed(1)), 415.3, 466.2),
    temperamentRoot: ((Math.round(root) % 12) + 12) % 12,   // wraps: −1 → 11, 12 → 0
    splitIndex: clamp(Math.round(i), 1, KEY_COUNT - 1),       // at least one key each side
    …
  };
}
```

Note the **floating-point fix**: `440 + 0.1` is `440.1` in maths but `440.09999999999997` in JavaScript. Rounding to the 0.1 Hz grid and `toFixed(1)` keeps the display and the comparisons (`=== 440`) clean.

### Why it's built this way

Controls, keyboard shortcuts, tests and future features (saved settings, presets) all go through `updateSettings → sanitizeSettings`. **Validate at the boundary**, and the rest of the code can trust its inputs.

---

## `constants.ts`

### Purpose

Every tunable number, named and documented: piano range, tuning limits, audio (volume, polyphony, compressor, soft pedal, stereo width), effect presets (reverb rooms, brilliance gains), metronome settings, key dimensions and note colors.

### Code explained

```ts
export const MIN_REFERENCE_PITCH = 415.3;   // matches the Roland FP-30X range
export const MAX_POLYPHONY = 64;
export const REVERB_PRESETS = {
  room: { duration: 0.9, decay: 3.5, preDelay: 0.004 },
  hall: { duration: 2.4, decay: 2.6, preDelay: 0.018 },
  cathedral: { duration: 5.2, decay: 1.9, preDelay: 0.035 },
} as const;
```

`as const` makes values deeply read-only with literal types.

### 🧪 Try it yourself

Set `STEREO_SPREAD` to `1` and play low and high notes on headphones. The keyboard sounds much wider. Set it to `0` for mono.

---

## `dom.ts`

### Purpose

`isTypingTarget(target)`: is a keyboard event coming from a place where the user types text? Both keyboard hooks use it.

```ts
const NON_TEXT_INPUT_TYPES = new Set(['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file', 'image']);

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUT_TYPES.has(target.type);
  return false;
}
```

`instanceof` checks are **type guards**: after them, TypeScript knows the exact element type. A tempo slider (`type="range"`) is *not* a typing target, so the keyboard keeps playing while it's focused.
