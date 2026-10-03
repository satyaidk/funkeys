# Web Audio API: how the piano makes sound

No audio files are used. Every note of all eight voices is **generated mathematically** in your browser as you play. This guide explains the concepts behind [`lib/audio/`](../../src/lib/audio/) from zero.

---

## 1. Sound in 30 seconds

- Sound is air **vibrating**; a speaker reproduces it by moving back and forth.
- **Frequency** (vibrations per second, **Hz**) is heard as **pitch**. A4 = 440 Hz.
- **Amplitude** is heard as **volume**.
- **Timbre** (tone color) is why a piano and a flute playing the same note sound different. It comes from which **partials** are present and how volume and tone change over time.

## 2. The mental model: a graph of nodes

Web Audio works like a guitar pedalboard: create **nodes** and **connect** them. Sound flows from *sources*, through *processors*, to the *destination* (speakers).

```ts
const ctx = new AudioContext();       // the "studio" that owns the clock and all nodes
const osc = ctx.createOscillator();   // source: a repeating wave
const gain = ctx.createGain();        // processor: volume
osc.connect(gain);
gain.connect(ctx.destination);        // speakers
osc.start();                          // 🔊
```

### Nodes this project uses

| Node | Role | Used for |
| --- | --- | --- |
| `OscillatorNode` | Source: sine/triangle/saw/square wave | Partials, FM modulators, LFOs, metronome clicks |
| `AudioBufferSourceNode` | Source: plays a buffer of samples | Hammer and pluck noise bursts |
| `GainNode` | Multiplies the signal | Partial levels, ADSR envelope, tremolo, master volume, reverb send |
| `BiquadFilterNode` | Filters frequencies | Per-voice low-pass (tone), high-shelf brilliance, band-pass noise |
| `StereoPannerNode` | Left/right position | Low notes left, high notes right |
| `ConvolverNode` | Convolution with an impulse response | Reverb |
| `DynamicsCompressorNode` | Turns down loud peaks | Stops chords from distorting |

**Nodes can also connect to parameters.** An oscillator connected to another oscillator's `frequency` or `detune` modulates it. That's how FM and vibrato work.

## 3. Additive synthesis: partials

A vibrating string sounds at its **fundamental** frequency *and* at multiples of it (2×, 3×, 4×…), called **partials** or harmonics. Stacking sine waves at those ratios, each quieter than the last, builds a rich tone. This is **additive synthesis**:

```ts
// voices.ts, Concert grand: 8 partials, each quieter than the last
partials: [1, 0.62, 0.4, 0.27, 0.17, 0.11, 0.07, 0.045].map((gain, i) => ({ ratio: i + 1, gain }))
```

The organ uses *drawbar* ratios (0.5, 1, 1.5, 2, 3, 4), the same footages (16′, 8′, 5⅓′…) as a Hammond organ. The celesta uses non-integer ratios (4.1, 6.7), which sound bell-like.

### Inharmonicity

Real piano strings are stiff, so their upper partials run slightly **sharp**: partial *n* sounds at `n × f × √(1 + B·n²)`. A tiny `B` (0.00035) is what makes the grand piano voices sound like a piano instead of an organ.

## 4. The envelope: how volume changes over time

```
Volume
 1.0 │  ╱╲
     │ ╱  ╲___
 0.55│╱       ‾‾‾‾‾‾‾╲___     ← natural fade while held (pianos, mallets)
     │                    ╲
 0.0 └──────────────────────╲──► time
      A  D    (held)         R
```

| Phase | Meaning | Grand piano |
| --- | --- | --- |
| **A**ttack | Silence → peak | 3 ms (hammer strike) |
| **D**ecay | Peak → sustain level | 280 ms |
| **S**ustain | Level while held | 0.55 |
| (Hold decay) | Pianos fade even while held; higher notes fade faster | 3.8 s at middle C, halving every two octaves |
| **R**elease | Fade after key-up | 320 ms (the damper) |

Organs and strings have no hold decay: they sound as long as the key is down.

The envelope is **scheduled automation** on the voice's gain:

```ts
gain.setValueAtTime(0, t0);
gain.linearRampToValueAtTime(peak, t0 + attack);
gain.linearRampToValueAtTime(peak * sustain, t0 + attack + decay);
gain.setTargetAtTime(0, t0 + attack + decay, holdTau);   // natural fade
```

### Why "scheduled"? The audio clock

`ctx.currentTime` runs on the **audio thread**, separate from JavaScript. Telling the browser "ramp to X by time T" makes it happen sample-accurately, even if the main thread is busy rendering React. **That's the key to glitch-free Web Audio.** The metronome relies on the same idea (§9).

### Releasing at the right level

On key-up the release must start from wherever the envelope *is right now*. Reading `gain.value` during a ramp isn't reliable across browsers, so `synth-voice.ts` **calculates** the level from elapsed time (`envelopeLevelAt()`), including the exponential hold decay.

## 5. Tone: filters, velocity and the soft pedal

Each voice runs through a **low-pass filter**:

- **Velocity opens it**: `cutoff + filter.velocity × velocity`. Harder playing is brighter, just like a harder hammer strike.
- **It closes over time** (`filter.decay`): the note mellows as it rings, like a real string losing its high overtones first.
- **The soft pedal** multiplies velocity by 0.65 and brightness by 0.55: quieter *and* darker, like the una corda.

Velocity to loudness is curved (`velocityToGain`): `0.08 + 0.92 × v^1.6`. Perceived loudness isn't linear, and the floor keeps the softest notes audible.

## 6. FM synthesis (electric piano)

**Frequency modulation**: a *modulator* oscillator wobbles a *carrier*'s frequency at audio rate. That creates new frequencies (sidebands) around the carrier. With a quickly decaying modulation depth you get a bright bell "ping" that settles into a pure tone, the classic electric-piano tine sound popularized by the Yamaha DX7.

```ts
modulator.connect(modGain);           // depth in Hz
modGain.connect(carrier.frequency);   // node → AudioParam
modGain.gain.setTargetAtTime(depth * 0.12, t0, fm.decay / 3);   // bell fades fast
```

## 7. LFOs: vibrato and tremolo

An **LFO** (low-frequency oscillator, a few Hz) modulates slowly:

- **Vibrato** (organ, strings) wobbles **pitch**: LFO → gain (depth in cents) → each oscillator's `detune`. The strings' vibrato fades in after 0.35 s, like a player settling into a note.
- **Tremolo** (electric piano, vibraphone motor) wobbles **volume**: LFO → gain → a tremolo GainNode's `gain`.

## 8. Noise transients

The first few milliseconds of a piano or harpsichord note include a burst of noise: the hammer thump or quill pluck. A shared half-second **white-noise buffer** is played through a band-pass filter with a 10–30 ms envelope at the start of those voices.

## 9. The master bus

```
voices ─► voice bus ─► brilliance ─┬───────────────► master ─► compressor ─► 🔊
                                    └─► reverb send ─► convolver ─┘   ▲
metronome clicks ─► metronome gain ───────────────────────────────────┘
```

- **Brilliance**: a `highshelf` BiquadFilter at 3.2 kHz, −7 dB (Mellow), 0 dB, or +6 dB (Bright).
- **Reverb**: a `ConvolverNode` blends in the room. The impulse response is generated as stereo noise fading by `(1 − t)^decay`, which approximates the dense reflections of a real hall. Each room's buffer is generated once and cached.
- **Compressor**: summed voices can exceed the maximum level (clipping); the compressor turns peaks down automatically.
- **Volume changes** use `setTargetAtTime(v, now, 0.01)`, a 10 ms glide that avoids "zipper noise" while you turn the knob.

### Stereo

Each voice passes through a `StereoPannerNode`: low notes sit left and high notes right, about how a piano sounds from the bench.

## 10. Polyphony and voice stealing

Every voice is a dozen or more nodes. The engine tracks all **live voices** (held or still fading) oldest first. Beyond **64**, the oldest voice gets a 15 ms fade. That's "voice stealing", like hardware pianos.

## 11. The metronome: two clocks

`setInterval(click, 60000 / bpm)` drifts and stutters, because JavaScript timers wait whenever the main thread is busy. The fix is the **lookahead scheduler** (Chris Wilson, "A Tale of Two Clocks"):

```
JS timer (every 25 ms, jittery):   |    |    |    |    |
lookahead window:                  [=====120 ms=====]
clicks booked on the audio clock:  ♪                ♪        ← exact
```

Every 25 ms a timer books any click due in the next 120 ms at its **exact audio-clock time**. The timer can be late; the clicks never are. The beat lights are delayed by `(clickTime − currentTime)` so they flash when the click is *heard*. See [ADR 0007](../decisions/0007-lookahead-metronome-scheduler.md).

## 12. The autoplay policy

Browsers **block audio until the user interacts with the page**. So the `AudioContext` is created inside the first key press or click, and resumed if the browser suspends it later.

`init()` is **synchronous**: it never awaits `resume()`. Awaiting it once let a quick tap's key-up arrive *before* the note existed, leaving it stuck on. Scheduling on a suspended context is fine; sound starts when it resumes. See [ADR 0005](../decisions/0005-synchronous-audio-init.md).

## 13. Voice lifecycle

```
playNote  ─► one voice per layer: partial oscillators + gains + envelope + filter + panner (+ FM, LFO, noise)
stopNote  ─► forget the note immediately  ─► ramp envelope to 0 over the release
          ─► stop every source just after the fade
          ─► onended: disconnect all nodes ─► garbage-collected, removed from live voices
```

**Forgetting immediately** matters. An early version deleted the note with a `setTimeout` after the fade; replaying the key during the fade let that timer delete the *new* voice, so the note could never be stopped. This race condition has a regression test in `audio-engine.test.ts`.

## Glossary

| Term | Meaning |
| --- | --- |
| **Partial / harmonic** | A frequency component of a tone (multiple of the fundamental) |
| **Inharmonicity** | Partials running slightly sharp, as in stiff piano strings |
| **Envelope** | How volume changes over a note's life |
| **Velocity** | How hard a key is played (0–1) |
| **FM** | Frequency modulation: one oscillator modulating another's pitch |
| **LFO** | Low-frequency oscillator, for vibrato and tremolo |
| **Impulse response** | How a room responds to a single click; used by convolution reverb |
| **Polyphony** | How many voices can sound at once |
| **Voice stealing** | Cutting the oldest voice when the limit is reached |
| **Lookahead scheduling** | Booking audio events slightly ahead on the audio clock |

## Further reading

- [MDN: Web Audio API](https://developer.mozilla.org/docs/Web/API/Web_Audio_API)
- [A Tale of Two Clocks (web.dev)](https://web.dev/articles/audio-scheduling)
- [MDN: Autoplay guide](https://developer.mozilla.org/docs/Web/Media/Autoplay_guide)
- [Wikipedia: Frequency modulation synthesis](https://en.wikipedia.org/wiki/Frequency_modulation_synthesis)
