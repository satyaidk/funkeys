# Digital piano functions

Keyboard Piano copies the functions found on real digital pianos such as the Yamaha Clavinova and P-series, the Roland FP-30X and Kawai's CA and CN models. This guide explains what each function does on a real instrument, and how this app implements it.

> **Research sources:** Yamaha Clavinova owner's manuals (temperament and base-note settings), Roland FP-30X owner's manual (master tuning 415.3–466.2 Hz, touch levels), [Wikipedia: Piano pedals](https://en.wikipedia.org/wiki/Piano_pedals), [Wikipedia: Werckmeister temperament](https://en.wikipedia.org/wiki/Werckmeister_temperament), [Wikipedia: Kirnberger temperament](https://en.wikipedia.org/wiki/Kirnberger_temperament), and the [Thomann digital piano guide](https://www.thomannmusic.com/onlineexpert_page_digital_pianos_additional_functions.html).

---

## Summary

| Function | On a real piano | In this app | Code |
| --- | --- | --- | --- |
| [Voices](#voices) | Built-in instrument sounds | 8 synthesized voices | `lib/audio/voices.ts` |
| [Layer (Dual)](#layer-dual) | Two voices on every key | Main + layer voice, balance knob | `resolveVoices()` |
| [Split](#split) | Different voice per hand | Left-hand voice, movable split point | `resolveVoices()` |
| [Pedals](#the-three-pedals) | Soft, sostenuto, sustain | All three, keyboard + on-screen | `lib/note-tracker.ts` |
| [Touch sensitivity](#touch-sensitivity) | How force maps to loudness | Light / Medium / Heavy / Fixed | `lib/audio/dynamics.ts` |
| [Reverb](#reverb) | Simulated room | Room / Concert hall / Cathedral + depth | `lib/audio/effects.ts` |
| [Brilliance](#brilliance) | Tone control | Mellow / Normal / Bright | `audio-engine.ts` |
| [Transpose](#transpose) | Shift pitch by semitones | ±12 semitones | `lib/music/tuning.ts` |
| [Master tuning](#master-tuning) | Set A4 frequency | 415.3–466.2 Hz in 0.1 Hz steps | `lib/music/tuning.ts` |
| [Temperament](#temperament) | Historical tuning systems | 6 temperaments + key | `lib/music/tuning.ts` |
| [Metronome](#metronome) | Steady click to practice with | Tempo, time signature, tap tempo | `lib/audio/metronome.ts` |
| [Recorder](#recorder) | Record and replay your playing | One-take performance recorder | `hooks/useRecorder.ts` |
| [Polyphony](#polyphony) | Max notes at once (64–256) | 64 voices with voice stealing | `audio-engine.ts` |

---

## Voices

A digital piano stores several instrument sounds ("voices" or "tones"). Real instruments use recorded samples; this app **synthesizes** each voice from a recipe (see [ADR 0009](../decisions/0009-data-driven-voice-recipes.md)):

| Voice | How it's made |
| --- | --- |
| Concert grand | 8 sine partials, slightly stretched (inharmonicity), hammer noise, tone mellows as it rings |
| Bright grand | Same, with stronger upper partials and a higher filter |
| Electric piano | FM synthesis (a modulator gives the bell-like "tine" attack) + tremolo |
| Harpsichord | Sawtooth partials with a quill-pluck noise burst, fast decay |
| Drawbar organ | Six drawbar partials (16′ to 2′), steady sustain, vibrato |
| String ensemble | Two detuned sawtooths, slow attack, delayed vibrato |
| Vibraphone | Sine bars with a strong 4th partial and motor tremolo |
| Celesta | Bell partials at inharmonic ratios, quick decay |

## Layer (Dual)

Plays **two voices on every key**, for example piano with strings underneath. Yamaha calls it "Dual", Roland "Dual" or "Layer". A balance control mixes the two: at the center both play at full level, and turning toward either side fades the other voice out.

## Split

Divides the keyboard at a **split point**: keys to the left play one voice, keys to the right another. A classic use is a bass voice for the left hand with piano for the right. Here the split point defaults to F4, exactly between the two computer-keyboard manuals, so the bottom rows are the left hand and the top rows the right. The fallboard shows each zone's voice, and an amber marker shows the split.

## The three pedals

A grand piano has three pedals, left to right:

| Pedal | Mechanism on a grand | Effect | This app |
| --- | --- | --- | --- |
| **Soft (una corda)** | Shifts the hammers so they strike fewer strings | Quieter, darker tone | Hold **Shift**: new notes play at 65% velocity with a darker filter |
| **Sostenuto** | Holds up only the dampers that were raised when it was pressed | Sustains selected notes; later notes behave normally | Click the pedal. Catches the notes held at that moment |
| **Sustain (damper)** | Lifts every damper off the strings | Released notes keep ringing | Hold **Space**, or click the pedal to latch it |

A subtle real-piano detail is implemented too: if the sustain pedal is down when you press sostenuto, sostenuto also catches the notes the sustain pedal was holding. See [ADR 0008](../decisions/0008-pedal-logic-as-a-pure-state-machine.md).

## Touch sensitivity

Real keys sense how fast you press. A **touch curve** decides how much force it takes to play loudly. Roland offers Super Light to Super Heavy plus Fixed; Yamaha offers Soft, Medium, Hard and Fixed.

| Curve | Formula (raw velocity v) | Feel |
| --- | --- | --- |
| Light | v^0.55 | Loud with little effort |
| Medium | v | Balanced |
| Heavy | v^1.7 | Needs a firm touch |
| Fixed | 0.75 | Every note equal |

A computer key can't sense force, so it sends a fixed raw velocity (0.72); the curve still sets how loud that is. With the mouse or a touch screen, **where** you press counts: nearer the front edge is louder, like pressing a real key further from its pivot.

Velocity also changes **tone**: harder notes open the voice's filter wider and sound brighter, just as a hammer hitting harder excites more overtones.

## Reverb

Simulates the room. A real concert hall's reflections make notes bloom and blend. This app uses a **convolution reverb**: the dry sound is combined with a generated *impulse response* (decaying noise, the sound of the room answering one clap). Longer tails mean bigger rooms: Room 0.9 s, Concert hall 2.4 s, Cathedral 5.2 s.

## Brilliance

A tone control: a high-shelf EQ above 3.2 kHz that cuts 7 dB (Mellow) or boosts 6 dB (Bright). Useful to match a room, or headphones that are too bright or dull.

## Transpose

Shifts the pitch by semitones **without moving your hands**: press C, hear D. Musicians use it to accompany a singer in a different key while playing the fingering they know. Range: ±12 semitones (shortcut: ↑ / ↓).

## Master tuning

Sets the frequency of **A4** (the A above middle C). 440 Hz is the international standard; many orchestras tune to 442 Hz; Baroque ensembles often use 415 Hz, a semitone lower. Range matches the Roland FP-30X: **415.3–466.2 Hz in 0.1 Hz steps**. Changing it lets you play along with recordings or instruments that aren't at 440.

## Temperament

How the 12 notes of the octave are spaced. Modern pianos use **equal temperament** (every semitone identical, every key sounds the same). Before about 1850, keyboards used other systems that made some keys purer and others rougher, which is part of why composers associated keys with moods. Clavinovas offer this same list:

| Temperament | Character |
| --- | --- |
| Equal | All keys identical |
| Pure major | Perfectly pure major chords in the chosen key; distant keys sound out of tune |
| Pythagorean | Pure fifths; bright, medieval melodies |
| Meantone (¼-comma) | Sweet major thirds; Renaissance and early Baroque |
| Werckmeister III | Baroque "well temperament": every key usable, each with its own color |
| Kirnberger III | Another well temperament, by a student of J. S. Bach |

Unequal temperaments depend on the **key** (base note): pick the key of the piece. The app keeps A4 at the master tuning in every temperament. The math is in [Music theory §8](./music-theory.md#8-temperaments).

## Metronome

A steady click to practice with. Settings: tempo 30–240 BPM (with the Italian tempo marking, e.g. *Andante*), time signature (2/4, 3/4, 4/4, 6/8; the first beat is accented, and in 6/8 beats 1 and 4), tap tempo, and click volume. Clicks are scheduled on the audio clock for sample-accurate timing ([ADR 0007](../decisions/0007-lookahead-metronome-scheduler.md)).

## Recorder

Records your performance as **events** (which key, when, how hard, pedal moves), not audio, the same way digital-piano recorders store MIDI data. Playback drives the live instrument, so keys light up and you can switch voices before replaying.

## Polyphony

The maximum number of notes a digital piano can sound at once: 64, 128 or 256 on current models. When exceeded, the oldest notes are cut ("voice stealing"). Here the limit is **64 voices**. In layer mode each key uses two voices.

## Not implemented (yet)

Real pianos also offer **damper resonance** (sympathetic string ringing with the sustain pedal), **duet mode** (two identical keyboard halves for teacher and student), **rhythm patterns**, and **MIDI/USB**. See the [roadmap](../roadmap.md).
