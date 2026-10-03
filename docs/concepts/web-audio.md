# Web Audio API: how the piano makes sound

No audio files are used. Every note is **generated mathematically** in your browser while you play. This guide explains the concepts behind [`src/lib/audio-engine.ts`](../../src/lib/audio-engine.ts), from zero.

---

## 1. Sound in 30 seconds

- Sound is air **vibrating**. A speaker reproduces it by moving back and forth.
- **Frequency** (how many vibrations per second, in **Hertz / Hz**) is what we hear as **pitch**. A4 = 440 Hz means 440 vibrations per second.
- **Amplitude** (how big the vibration is) is what we hear as **volume**.
- **Timbre** (tone color) is *why a piano and a flute playing the same note sound different*. It comes from which **harmonics** are present and how the volume changes over time.

Our engine controls all three: frequency (which note), amplitude (volume + envelope) and timbre (harmonics + filter).

## 2. The Web Audio mental model: a graph of nodes

The Web Audio API works like a guitar pedalboard. You create **nodes** and **connect** them with virtual cables. Sound flows from *source* nodes, through *processing* nodes, to the *destination* (your speakers).

```
source ──► processor ──► processor ──► destination (speakers)
```

```ts
const ctx = new AudioContext();         // the "studio" that owns everything
const osc = ctx.createOscillator();     // a source: generates a tone
const gain = ctx.createGain();          // a processor: changes volume
osc.connect(gain);                      // cable: osc → gain
gain.connect(ctx.destination);          // cable: gain → speakers
osc.start();                            // 🔊
```

### Nodes this project uses

| Node | Role | Used for |
| --- | --- | --- |
| `AudioContext` | The audio "studio". Owns the clock and all nodes | Created once, on first interaction |
| `OscillatorNode` | **Source**: generates a repeating wave at a frequency | 6 per note (fundamental + 5 harmonics) |
| `GainNode` | Multiplies the signal by a number (0 = silent, 1 = unchanged) | Harmonic levels, ADSR envelope, master volume |
| `BiquadFilterNode` | Removes some frequencies | Low-pass at 5 kHz to soften harshness |
| `DynamicsCompressorNode` | Automatically turns down loud peaks | Prevents distortion when playing chords |
| `ctx.destination` | Your speakers | End of the chain |

## 3. Oscillators and wave shapes

An oscillator produces a wave that repeats `frequency` times per second. The **shape** of the wave changes the tone:

```
sine      ∿∿∿∿   pure, soft, "flute-like"  (one frequency only)
triangle  /\/\/\  warmer, a little brighter
square    ⊓⊔⊓⊔   hollow, retro video game
sawtooth  /|/|/|  buzzy, bright, "brassy"
```

The fundamental uses `triangle` (warm body); the harmonics use pure `sine` waves so we control exactly how much of each is added.

## 4. Harmonics: why six oscillators per note?

When a real piano string vibrates, it doesn't vibrate at just one frequency. It vibrates as a whole (the **fundamental**) and *also* in halves, thirds, quarters… producing quieter tones at **2×, 3×, 4×… the fundamental frequency**. These are **harmonics** (or overtones), and they're what make a piano sound rich instead of like a beep.

```
Fundamental (1×)  ════════════════════════   440 Hz  loudest
2nd harmonic (2×) ══════════════              880 Hz
3rd harmonic (3×) ═══════                    1320 Hz
4th harmonic (4×) ═══                        1760 Hz
5th harmonic (5×) ══                         2200 Hz
6th harmonic (6×) ═                          2640 Hz  quietest
```

From [`constants.ts`](../../src/lib/constants.ts):

```ts
export const HARMONIC_RATIOS     = [1, 2, 3, 4, 5, 6] as const;
export const HARMONIC_AMPLITUDES = [1.0, 0.5, 0.25, 0.125, 0.0625, 0.03] as const;
```

Each harmonic is roughly **half as loud** as the previous one. This is called **additive synthesis**: building a complex sound by adding simple sine waves together.

> 🧪 **Try it:** set `HARMONIC_AMPLITUDES` to `[1, 0, 0, 0, 0, 0]`. The piano will sound like a plain beep. Then try `[1, 0.8, 0.6, 0.4, 0.2, 0.1]` for a brighter, organ-like tone.

## 5. The ADSR envelope: how volume changes over time

If a sound jumped instantly from silent to full volume and back, it would click and sound robotic. Real instruments have a **shape over time**, described by four phases:

```
Volume
 1.0 │   ╱╲
     │  ╱  ╲
 0.2 │ ╱    ╲________________
     │╱                       ╲
 0.0 └──────────────────────────╲──► time
      A   D        S            R
     5ms 300ms  (while held)   800ms
```

| Phase | Meaning | Piano analogy | Value |
| --- | --- | --- | --- |
| **A**ttack | Time to go from silence to peak | Hammer hits the string, instantly | 0.005s |
| **D**ecay | Time to fall from peak to the sustain level | The bright "ping" fades | 0.3s |
| **S**ustain | Level held while the key is down (a level, not a time) | String keeps ringing softly | 0.2 |
| **R**elease | Time to fade to silence after the key is released | Damper stops the string | 0.8s |

The envelope is applied to the note's `GainNode` using **scheduled automation**:

```ts
gain.setValueAtTime(0, now);                                  // start silent
gain.linearRampToValueAtTime(1.0, now + attack);              // A
gain.linearRampToValueAtTime(sustain, now + attack + decay);  // D → S
// …later, on key release:
gain.cancelScheduledValues(now);
gain.setValueAtTime(currentLevel, now);                       // freeze where we are
gain.linearRampToValueAtTime(0, now + release);               // R
```

### Why "scheduled"? The audio clock

`ctx.currentTime` is a high-precision clock (in seconds) that runs on the **audio thread**, separate from JavaScript. Instead of changing volume in a `setInterval` loop (jittery, because JS can pause), we tell the browser *"ramp to 1.0 by time X"* and it executes sample-accurately on its own. **This is the key to glitch-free web audio.**

### A subtle bug worth knowing

When releasing, we need the envelope's *current* level to ramp down from. The obvious code is `gain.setValueAtTime(gain.gain.value, now)`, but **not every browser updates `.value` while a ramp is running**, so the release could jump to the wrong level and click. The engine instead **calculates** the level from the elapsed time (`getEnvelopeLevel()`). Reading values from the audio thread is unreliable; computing them is deterministic.

## 6. Filter: taming harshness

A **low-pass filter** lets low frequencies pass and cuts high ones. With `FILTER_CUTOFF = 5000` Hz, it rounds off the harsh, fizzy top end that stacked oscillators can produce, making the tone warmer.

## 7. Master bus: volume and compressor

All voices merge into one **master gain** (the volume slider) and then a **compressor**:

```
voice 1 ─┐
voice 2 ─┼─► master gain (volume) ─► compressor ─► 🔊
voice 3 ─┘
```

Each voice adds to the total signal. Play a 5-note chord and the sum can exceed the maximum level, which causes **clipping** (harsh distortion). The compressor watches the level and automatically turns it down when it crosses a threshold (`-12 dB`, ratio `4:1`). That's what professional audio software does on its master channel.

Volume changes use `setTargetAtTime(value, now, 0.01)`, which glides over ~10ms instead of jumping, to avoid "zipper noise" while you drag the slider.

## 8. The autoplay policy

Browsers **block audio until the user interacts with the page** (click, tap, key press), so websites can't blast sound at you on load. Consequences:

1. We can't create the `AudioContext` on page load, or it starts `suspended`.
2. So we **lazy-initialize**: the context is created inside the first key press or click handler.
3. If the browser suspends it later (e.g. on iOS after a phone call), we call `ctx.resume()` on the next interaction.

### Why `init()` is synchronous

`resume()` returns a Promise. An early version **awaited** it before playing the note. Then a very quick tap went like this:

```
keydown → await resume() …waiting…
keyup   → stopNote("C4") → nothing to stop yet!
          …resume finishes → playNote("C4") → 🔊 forever (stuck note)
```

The fix: create nodes **immediately** without awaiting. Notes scheduled on a suspended context simply start when it resumes, and the key-up always finds the note. See [ADR 0005](../decisions/0005-synchronous-audio-init.md).

## 9. Voice lifecycle and memory

```
playNote ─► create 6 osc + 7 gains + 1 filter, start oscillators
stopNote ─► remove from activeNotes map immediately
          ─► ramp gain to 0 over release time
          ─► osc.stop(at end of release)
          ─► onended → disconnect all nodes → garbage-collected
```

**Removing from the map immediately** matters. An earlier version deleted the entry with a `setTimeout` *after* the fade. If you pressed the same key again during the fade, the timer deleted the *new* note's entry, and the next key-up couldn't find it, so the note rang forever. This is a classic **race condition**, and it now has a regression test in `audio-engine.test.ts`.

## 10. Glossary

| Term | Meaning |
| --- | --- |
| **Hz (Hertz)** | Cycles per second, i.e. pitch |
| **Fundamental** | The main frequency of a note |
| **Harmonic / overtone** | A quieter frequency at a whole-number multiple of the fundamental |
| **Timbre** | The "color" of a sound that distinguishes instruments |
| **Envelope (ADSR)** | How a sound's volume changes over time |
| **Voice** | One playing note (here: its 6 oscillators and nodes) |
| **Polyphony** | Playing several voices at once |
| **Clipping** | Distortion when a signal exceeds the maximum level |
| **Compressor** | Reduces loud peaks automatically |
| **Low-pass filter** | Removes frequencies above a cutoff |
| **Audio thread** | Separate high-priority thread where the browser processes audio |

## Further reading

- [MDN: Web Audio API](https://developer.mozilla.org/docs/Web/API/Web_Audio_API)
- [MDN: Basic concepts behind Web Audio](https://developer.mozilla.org/docs/Web/API/Web_Audio_API/Basic_concepts_behind_Web_Audio_API)
- [MDN: Autoplay guide](https://developer.mozilla.org/docs/Web/Media/Autoplay_guide)
