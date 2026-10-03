# Part 3: Audio (`src/lib/audio/`)

The sound of the instrument: voice recipes, dynamics, effects, voice synthesis, the engine, and the metronome scheduler. Read [Web Audio concepts](../concepts/web-audio.md) first.

| File | Responsibility |
| --- | --- |
| [`voices.ts`](#voicests) | The 8 instrument recipes + which voices a key plays |
| [`dynamics.ts`](#dynamicsts) | Touch curves and velocity → loudness |
| [`effects.ts`](#effectsts) | Reverb rooms (impulse responses), brilliance options |
| [`synth-voice.ts`](#synth-voicets) | Builds one sounding voice from a recipe |
| [`audio-engine.ts`](#audio-enginets) | Owns the AudioContext, master chain, polyphony, clicks |
| [`metronome.ts`](#metronomets) | Lookahead click scheduler, tap tempo, tempo markings |

---

## `voices.ts`

### Purpose

Describes **how to synthesize** each instrument as data, and decides which voices a key plays in single, layer or split mode.

### Code explained

```ts
export interface VoiceDefinition {
  id: VoiceId; name: string; description: string;
  partials: PartialSpec[];          // { ratio, gain, type?, detune? }
  inharmonicity?: number;           // piano string stiffness
  envelope: { attack, decay, sustain, release };
  holdDecay?: number;               // natural fade while held (s, at middle C)
  filter: { cutoff, q, velocity, decay? };
  fm?: { ratio, index, decay };     // electric piano bell
  lfo?: { kind: 'vibrato' | 'tremolo', rate, depth, delay? };
  attackNoise?: { gain, frequency, duration };   // hammer / pluck
  gain: number;                     // loudness trim
}
```

Eight entries in `VOICES` fill this in. The organ, for example, is six sine drawbars, a steady sustain and vibrato.

```ts
export function resolveVoices(routing: VoiceRouting, keyIndex: number): VoiceLayer[] {
  if (routing.mode === 'split' && keyIndex < routing.splitIndex) return [{ voice: routing.splitVoice, gain: 1 }];
  if (routing.mode === 'layer') {
    const b = clamp(routing.layerBalance);
    return [
      { voice: routing.voice, gain: Math.min(1, 2 * (1 - b)) },
      { voice: routing.layerVoice, gain: Math.min(1, 2 * b) },
    ].filter((layer) => layer.gain > 0);
  }
  return [{ voice: routing.voice, gain: 1 }];
}
```

The layer balance curve keeps both voices at full level in the middle and fades one out toward either end. `VoiceRouting` is a subset of `PianoSettings`, so `resolveVoices(settings, i)` works directly.

### Why it's built this way

**Data-driven voices** ([ADR 0009](../decisions/0009-data-driven-voice-recipes.md)): adding an instrument is adding an object, with no engine changes, and every recipe is validated by the same test (`it.each(VOICES)`).

### 🧪 Try it yourself

Add a **"Choir"** voice: `partials` `[1, 2, 3]` with `type: 'sawtooth'`, `envelope` `{ attack: 0.4, decay: 0.3, sustain: 0.8, release: 1 }`, `filter` `{ cutoff: 1100, q: 4, velocity: 600 }` (the resonant Q hints at a vowel), vibrato `{ kind: 'vibrato', rate: 5, depth: 12, delay: 0.3 }`, `gain: 0.2`. Add `'choir'` to `VoiceId` and update the voice-count test.

---

## `dynamics.ts`

### Purpose

How playing strength becomes loudness.

### Code explained

```ts
export function applyTouchCurve(raw: number, curve: TouchCurve): number {
  switch (curve) {
    case 'light': return clamp(v ** 0.55, 0.05, 1);   // lifts soft playing
    case 'heavy': return clamp(v ** 1.7, 0.05, 1);    // lowers it
    case 'fixed': return FIXED_VELOCITY;              // 0.75 always
    default:      return clamp(v, 0.05, 1);           // medium
  }
}
export const velocityFromPosition = (fraction) => 0.35 + 0.65 * clamp(fraction, 0, 1);
export const velocityToGain = (v) => 0.08 + 0.92 * v ** 1.6;
```

- Curves are **power functions**: exponents below 1 bend the curve up (light), above 1 down (heavy)
- Mouse and touch: pressing nearer the key's front edge is louder (`velocityFromPosition`)
- `velocityToGain` maps velocity to amplitude with a floor, because hearing is logarithmic

---

## `effects.ts`

### Purpose

Reverb room options and the **impulse-response generator**, plus brilliance options.

### Code explained

```ts
export function createImpulseResponse(context, preset, random = Math.random): AudioBuffer {
  const buffer = context.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = preDelay; i < length; i++) {
      const t = (i - preDelay) / (length - preDelay);
      data[i] = (random() * 2 - 1) * Math.pow(1 - t, preset.decay);
    }
  }
  return buffer;
}
```

Decaying stereo noise approximates a room's dense reflections. `random` is **injectable**: tests pass `() => 1` for deterministic output. Injecting sources of randomness and time is how you make code testable.

---

## `synth-voice.ts`

### Purpose

`createVoice(context, destination, recipe, params)` wires up **one voice of one note**, starts it, and returns a handle with `release()`.

### Code explained

The node chain, built bottom-up so each node can connect to the next:

```
panner ◄─ low-pass filter ◄─ (tremolo) ◄─ envelope ◄─ partial gains ◄─ partial oscillators
                                                                         ▲          ▲
                                                               vibrato LFO     FM modulator
noise burst ─► band-pass ─► noise gain ─► panner
```

Key details:

```ts
const velocity = params.soft ? params.velocity * SOFT_PEDAL.velocityScale : params.velocity;
const peak = velocityToGain(velocity) * def.gain * params.gain;
const holdTau = def.holdDecay ? holdDecayFor(def.holdDecay, params.midi) : null;  // higher = shorter
```

- **Filter**: starts at `cutoff + velocity × filter.velocity` (brighter when harder), never below 1.5× the fundamental, and decays toward `cutoff` as the note rings
- **Partials**: normalized so their gains sum to 1, stretched by inharmonicity, skipped above 16 kHz
- **`vibratoGain?.connect(osc.detune)`**: optional chaining on a method call. If there's no vibrato, nothing happens
- **FM**: each carrier's `frequency` param receives a modulator through a gain whose depth decays quickly

```ts
release(time, fadeTime = def.envelope.release) {
  if (released) return;                      // idempotent
  released = true;
  envelope.gain.cancelScheduledValues(time);
  envelope.gain.setValueAtTime(envelopeLevelAt(time), time);   // computed, not read
  envelope.gain.linearRampToValueAtTime(0, time + fadeTime);
  sources.forEach((s) => s.stop(time + fadeTime + 0.05));
}
```

When the last source ends (`onended`), every node is disconnected and `voice.onEnded` tells the engine to forget it.

### Why it's built this way

Separating **one voice** (this file) from **voice management** (the engine) keeps both small. `createVoice` is a pure builder you can test node by node with the fake AudioContext (17 tests).

---

## `audio-engine.ts`

### Purpose

The **class that owns the audio graph**: the AudioContext, the master chain (brilliance → reverb → master → compressor), all voices per note, polyphony, and metronome clicks.

### Public API

| Method | What it does |
| --- | --- |
| `init()` | Create the context and master chain once; resume if suspended (synchronous) |
| `playNote(id, frequency, options)` | One voice per layer, tracked under the note id |
| `stopNote(id, immediate?)` | Release every voice of the note (forgotten immediately) |
| `stopAllNotes()` | Quick fade for everything held |
| `setVolume / setReverb / setBrilliance / setMetronomeVolume` | Safe before `init()`; applied when the context exists |
| `scheduleClick(time, accent)` | A short triangle-wave blip at an exact audio time |
| `currentTime`, `voiceCount`, `isNotePlaying(id)` | Read-only state |
| `destroy()` | Stop everything, close the context |

### Code explained

```ts
private activeNotes = new Map<string, SynthVoice[]>();   // held notes → their voices
private liveVoices: SynthVoice[] = [];                   // everything still sounding, oldest first

private enforcePolyphony(now: number) {
  while (this.liveVoices.length > MAX_POLYPHONY) {
    this.liveVoices.shift()!.release(now, QUICK_RELEASE);   // voice stealing
  }
}
```

```ts
private applyReverb() {
  if (this.reverb === 'off') { this.reverbSend.gain.setTargetAtTime(0, now, 0.02); return; }
  let impulse = this.impulseCache.get(this.reverb);
  if (!impulse) { impulse = createImpulseResponse(this.context, REVERB_PRESETS[this.reverb]); this.impulseCache.set(this.reverb, impulse); }
  this.convolver.buffer = impulse;
  this.reverbSend.gain.setTargetAtTime(this.reverbLevel, now, 0.02);
}
```

- Settings are **stored** in private fields first, then applied if the graph exists, so the engine can be configured before the first user gesture
- Impulse responses are **cached** per room (generating a cathedral tail takes a moment)
- The reverb send starts at 0 and fades up, avoiding a burst of reverb on the first note

### Why it's built this way

A **class** fits an object with a long-lived lifecycle and internal resources. React never sees audio nodes; it calls a small API through `useAudioEngine`.

### 🧪 Try it yourself

Change `MAX_POLYPHONY` to `4` in `constants.ts`, turn sustain on, and play a long run. You'll hear the oldest notes cut off. That's voice stealing. Restore it.

---

## `metronome.ts`

### Purpose

Sample-accurate metronome clicks using the **lookahead scheduler**, plus helpers: time signatures, tempo markings, tap tempo.

### Code explained

```ts
tick(): void {
  const horizon = this.clock.currentTime + METRONOME_SCHEDULE_AHEAD;   // 120 ms ahead
  while (this.nextBeatTime < horizon) {
    this.clock.scheduleClick(this.nextBeatTime, this.timeSignature.accents.includes(this.beat));
    this.onBeat?.(this.beat, this.nextBeatTime);
    this.beat = (this.beat + 1) % this.timeSignature.beats;
    this.nextBeatTime += 60 / this.bpm;
  }
}
```

`start()` runs `tick()` every 25 ms. The scheduler depends on a tiny **`MetronomeClock` interface** (`currentTime` + `scheduleClick`), not on `AudioEngine`, so tests drive it with a fake clock ([ADR 0007](../decisions/0007-lookahead-metronome-scheduler.md)).

```ts
export function tempoFromTaps(taps: readonly number[]): number | null {
  // keep only the latest burst (taps ≤ 2 s apart), average the last 4 intervals
}
export function tempoMarking(bpm: number): string   // 96 → 'Andante'
```

### Why it's built this way

The scheduler is the textbook solution to "JavaScript timers drift". It's worth being able to explain it in an interview: it separates **when the code runs** (jittery) from **when the sound happens** (exact).

### 🧪 Try it yourself

Add a **5/4** time signature (`{ id: '5/4', beats: 5, accents: [0, 3] }`, as in Brubeck's *Take Five*) to `TIME_SIGNATURES`. It appears in the Metronome page automatically.
