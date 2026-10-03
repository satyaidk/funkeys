/**
 * @fileoverview Builds one sounding voice from a voice recipe.
 *
 * `createVoice()` wires up the Web Audio nodes for a single instrument voice
 * of a single note, starts it, and returns a handle used to release it.
 *
 * ```
 *  partial oscillators ─► partial gains ─┐
 *        ▲      ▲                        ├─► envelope ─► tremolo ─► low-pass ─► panner ─► destination
 *        │      └─ vibrato LFO (detune)  │      (ADSR)   (optional)  (tone)     (stereo)
 *        └──────── FM modulator          │
 *  hammer/pluck noise ─► band-pass ──────┴──────────────────────────────────────► panner
 * ```
 *
 * Realism details borrowed from acoustic instruments:
 * - **Velocity** sets both loudness and brightness (harder = brighter)
 * - **Natural decay**: piano-like voices fade even while the key is held,
 *   and higher notes fade faster, just like shorter strings
 * - **Tone decay**: the low-pass cutoff falls as the note rings, so the
 *   sound mellows over time
 * - **Inharmonicity**: stiff piano strings stretch their upper partials sharp
 * - **Stereo position**: low notes sit left, high notes right
 */

import { SOFT_PEDAL, STEREO_SPREAD } from '../constants';
import { velocityToGain } from './dynamics';
import { VoiceDefinition } from './voices';

export interface VoiceParams {
  /** Fundamental frequency in Hz */
  frequency: number;
  /** Playing strength after the touch curve (0–1) */
  velocity: number;
  /** Sounding MIDI number (for stereo position and pitch-dependent decay) */
  midi: number;
  /** Share of the volume (layer balance) */
  gain: number;
  /** Soft pedal held: quieter and darker */
  soft: boolean;
  /** Audio-clock time to start at */
  startTime: number;
  /** Shared white-noise buffer for hammer/pluck transients */
  noiseBuffer: AudioBuffer | null;
}

export interface SynthVoice {
  readonly startTime: number;
  readonly released: boolean;
  /**
   * Fade out and stop.
   * @param time     - Audio-clock time to start the fade
   * @param fadeTime - Seconds to reach silence (defaults to the voice's release)
   */
  release(time: number, fadeTime?: number): void;
  /** Called once every node has stopped and been disconnected */
  onEnded: (() => void) | null;
}

/** Highest partial frequency worth generating (higher just aliases) */
const MAX_PARTIAL_HZ = 16000;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Natural decay time for a note: halves every two octaves above middle C */
export function holdDecayFor(baseSeconds: number, midi: number): number {
  return Math.max(0.25, baseSeconds * Math.pow(2, -(midi - 60) / 24));
}

/** Stereo position for a note (−1 = left, 1 = right) */
export function panFor(midi: number): number {
  return clamp((midi - 66) / 30, -1, 1) * STEREO_SPREAD;
}

export function createVoice(
  context: BaseAudioContext,
  destination: AudioNode,
  def: VoiceDefinition,
  params: VoiceParams
): SynthVoice {
  const t0 = params.startTime;
  const { attack, decay, sustain } = def.envelope;
  const velocity = params.soft ? params.velocity * SOFT_PEDAL.velocityScale : params.velocity;
  const brightness = params.soft ? SOFT_PEDAL.brightnessScale : 1;
  const peak = velocityToGain(velocity) * def.gain * params.gain;
  const holdTau = def.holdDecay ? holdDecayFor(def.holdDecay, params.midi) : null;

  const nodes: AudioNode[] = [];
  const sources: AudioScheduledSourceNode[] = [];
  const track = <T extends AudioNode>(node: T): T => {
    nodes.push(node);
    return node;
  };

  // ── Output: stereo position ───────────────────────────────────────────
  let output: AudioNode = destination;
  if (typeof context.createStereoPanner === 'function') {
    const panner = track(context.createStereoPanner());
    panner.pan.setValueAtTime(panFor(params.midi), t0);
    panner.connect(destination);
    output = panner;
  }

  // ── Tone filter: brighter with velocity, mellowing as the note rings ──
  const filter = track(context.createBiquadFilter());
  filter.type = 'lowpass';
  filter.Q.setValueAtTime(def.filter.q, t0);
  const floorCutoff = Math.max(def.filter.cutoff * brightness, params.frequency * 1.5);
  const startCutoff = clamp(
    (def.filter.cutoff + def.filter.velocity * velocity) * brightness,
    floorCutoff,
    18000
  );
  filter.frequency.setValueAtTime(startCutoff, t0);
  if (def.filter.decay) {
    filter.frequency.setTargetAtTime(floorCutoff, t0 + attack, def.filter.decay);
  }
  filter.connect(output);

  // ── Tremolo (volume wobble) ───────────────────────────────────────────
  let envelopeOut: AudioNode = filter;
  let vibratoGain: GainNode | null = null;
  if (def.lfo) {
    const lfo = context.createOscillator();
    lfo.frequency.setValueAtTime(def.lfo.rate, t0);
    const lfoGain = track(context.createGain());
    lfo.connect(lfoGain);
    sources.push(lfo);
    nodes.push(lfo);

    if (def.lfo.kind === 'tremolo') {
      const tremolo = track(context.createGain());
      tremolo.gain.setValueAtTime(1 - def.lfo.depth / 2, t0);
      lfoGain.gain.setValueAtTime(def.lfo.depth / 2, t0);
      lfoGain.connect(tremolo.gain);
      tremolo.connect(filter);
      envelopeOut = tremolo;
    } else {
      // Vibrato fades in after `delay`, like a string player settling into a note
      const delay = def.lfo.delay ?? 0;
      lfoGain.gain.setValueAtTime(0, t0);
      lfoGain.gain.linearRampToValueAtTime(0, t0 + delay);
      lfoGain.gain.linearRampToValueAtTime(def.lfo.depth, t0 + delay + 0.3);
      vibratoGain = lfoGain;
    }
    lfo.start(t0);
  }

  // ── Envelope: attack → decay → sustain (→ natural fade) ──────────────
  const envelope = track(context.createGain());
  envelope.gain.setValueAtTime(0, t0);
  envelope.gain.linearRampToValueAtTime(peak, t0 + attack);
  envelope.gain.linearRampToValueAtTime(peak * sustain, t0 + attack + decay);
  if (holdTau) {
    envelope.gain.setTargetAtTime(0, t0 + attack + decay, holdTau);
  }
  envelope.connect(envelopeOut);

  // ── Partials ──────────────────────────────────────────────────────────
  const totalPartialGain = def.partials.reduce((sum, p) => sum + p.gain, 0);
  const B = def.inharmonicity ?? 0;

  def.partials.forEach((partial) => {
    const stretch = Math.sqrt(1 + B * partial.ratio * partial.ratio);
    const frequency = params.frequency * partial.ratio * stretch;
    if (frequency > MAX_PARTIAL_HZ) return;

    const osc = context.createOscillator();
    osc.type = partial.type ?? 'sine';
    osc.frequency.setValueAtTime(frequency, t0);
    if (partial.detune) osc.detune.setValueAtTime(partial.detune, t0);

    const partialGain = track(context.createGain());
    partialGain.gain.setValueAtTime(partial.gain / totalPartialGain, t0);
    osc.connect(partialGain);
    partialGain.connect(envelope);

    vibratoGain?.connect(osc.detune);

    // FM: a modulator shakes the pitch at audio rate, adding bell-like
    // sidebands that fade quickly, the "tine" attack of an electric piano
    if (def.fm) {
      const modulator = context.createOscillator();
      const modFrequency = frequency * def.fm.ratio;
      modulator.frequency.setValueAtTime(modFrequency, t0);
      const depth = def.fm.index * modFrequency * (0.5 + velocity * 0.8);
      const modGain = track(context.createGain());
      modGain.gain.setValueAtTime(depth, t0);
      modGain.gain.setTargetAtTime(depth * 0.12, t0 + 0.005, def.fm.decay / 3);
      modulator.connect(modGain);
      modGain.connect(osc.frequency);
      modulator.start(t0);
      sources.push(modulator);
      nodes.push(modulator);
    }

    osc.start(t0);
    sources.push(osc);
    nodes.push(osc);
  });

  // ── Hammer / pluck noise ──────────────────────────────────────────────
  if (def.attackNoise && params.noiseBuffer) {
    const { gain, frequency, duration } = def.attackNoise;
    const noise = context.createBufferSource();
    noise.buffer = params.noiseBuffer;
    const band = track(context.createBiquadFilter());
    band.type = 'bandpass';
    band.frequency.setValueAtTime(frequency * brightness, t0);
    band.Q.setValueAtTime(1.2, t0);
    const noiseGain = track(context.createGain());
    const noisePeak = gain * velocityToGain(velocity) * params.gain;
    noiseGain.gain.setValueAtTime(0, t0);
    noiseGain.gain.linearRampToValueAtTime(noisePeak, t0 + 0.001);
    noiseGain.gain.linearRampToValueAtTime(0, t0 + duration);
    noise.connect(band);
    band.connect(noiseGain);
    noiseGain.connect(output);
    noise.start(t0);
    noise.stop(t0 + duration + 0.02);
    nodes.push(noise);
  }

  /** Envelope level reached at `time`, computed to match the scheduled automation */
  const envelopeLevelAt = (time: number): number => {
    const elapsed = time - t0;
    if (elapsed <= 0) return 0;
    if (elapsed < attack) return peak * (elapsed / attack);
    if (elapsed < attack + decay) return peak * (1 - (1 - sustain) * ((elapsed - attack) / decay));
    const held = peak * sustain;
    return holdTau ? held * Math.exp(-(elapsed - attack - decay) / holdTau) : held;
  };

  let released = false;

  const voice: SynthVoice = {
    startTime: t0,
    get released() {
      return released;
    },
    release(time: number, fadeTime: number = def.envelope.release) {
      if (released) return;
      released = true;
      envelope.gain.cancelScheduledValues(time);
      envelope.gain.setValueAtTime(envelopeLevelAt(time), time);
      envelope.gain.linearRampToValueAtTime(0, time + fadeTime);
      const stopAt = time + fadeTime + 0.05;
      sources.forEach((source) => {
        try { source.stop(stopAt); } catch { /* already stopped */ }
      });
    },
    onEnded: null,
  };

  // Every source stops at the same moment on release, so when the last one
  // started ends, the whole voice is silent: free the graph
  const lastSource = sources[sources.length - 1];
  lastSource.onended = () => {
    nodes.forEach((node) => node.disconnect());
    voice.onEnded?.();
  };

  return voice;
}
