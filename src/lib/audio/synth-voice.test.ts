import { describe, it, expect, beforeEach } from 'vitest';
import { createVoice, holdDecayFor, panFor, VoiceParams } from './synth-voice';
import { getVoice, VoiceDefinition } from './voices';
import { SOFT_PEDAL } from '../constants';
import {
  FakeAudioContext,
  FakeAudioNode,
  FakeAudioParam,
  FakeGainNode,
  installFakeAudioContext,
  partialOscillators,
} from '@/test/fake-web-audio';

const params = (overrides: Partial<VoiceParams> = {}): VoiceParams => ({
  frequency: 440,
  velocity: 0.8,
  midi: 69,
  gain: 1,
  soft: false,
  startTime: 0,
  noiseBuffer: null,
  ...overrides,
});

/** A minimal recipe so tests don't depend on the tuned instrument values */
const testVoice = (overrides: Partial<VoiceDefinition> = {}): VoiceDefinition => ({
  id: 'grand',
  name: 'Test',
  description: '',
  partials: [
    { ratio: 1, gain: 1 },
    { ratio: 2, gain: 1 },
  ],
  envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.4 },
  filter: { cutoff: 1000, q: 1, velocity: 2000 },
  gain: 1,
  ...overrides,
});

describe('createVoice', () => {
  let ctx: FakeAudioContext;
  let out: FakeAudioNode;

  beforeEach(() => {
    installFakeAudioContext();
    ctx = new FakeAudioContext();
    out = new FakeAudioNode();
  });

  const build = (def: VoiceDefinition, p: Partial<VoiceParams> = {}) =>
    createVoice(ctx as unknown as BaseAudioContext, out as unknown as AudioNode, def, params(p));

  /** The envelope gain is the node every partial gain feeds into */
  const envelopeOf = () => {
    const [partialGain] = [...partialOscillators(ctx)[0].connections] as FakeGainNode[];
    return [...partialGain.connections][0] as FakeGainNode;
  };

  it('starts one oscillator per partial at multiples of the frequency', () => {
    build(testVoice());
    const freqs = ctx.oscillators.map((o) => o.frequency.value);
    expect(freqs).toEqual([440, 880]);
    ctx.oscillators.forEach((o) => expect(o.startTime).toBe(0));
  });

  it('stretches upper partials sharp when the recipe is inharmonic', () => {
    build(testVoice({ inharmonicity: 0.001 }));
    expect(ctx.oscillators[1].frequency.value).toBeGreaterThan(880);
  });

  it('skips partials above the audible range', () => {
    build(testVoice({ partials: [{ ratio: 1, gain: 1 }, { ratio: 50, gain: 1 }] }));
    expect(ctx.oscillators).toHaveLength(1);
  });

  it('plays louder at higher velocity', () => {
    build(testVoice(), { velocity: 0.3 });
    const soft = envelopeOf().gain.events[1].value!;
    ctx = new FakeAudioContext();
    build(testVoice(), { velocity: 1 });
    expect(envelopeOf().gain.events[1].value!).toBeGreaterThan(soft);
  });

  it('opens the tone filter wider at higher velocity', () => {
    build(testVoice(), { velocity: 1 });
    expect(ctx.filters[0].frequency.value).toBe(3000);
  });

  it('makes the soft pedal quieter and darker', () => {
    build(testVoice(), { soft: true, velocity: 1 });
    const softPeak = envelopeOf().gain.events[1].value!;
    // Both the velocity (less filter opening) and the brightness are reduced
    expect(ctx.filters[0].frequency.value).toBeCloseTo(
      (1000 + 2000 * SOFT_PEDAL.velocityScale) * SOFT_PEDAL.brightnessScale
    );

    ctx = new FakeAudioContext();
    build(testVoice(), { soft: false, velocity: 1 });
    expect(envelopeOf().gain.events[1].value!).toBeGreaterThan(softPeak);
  });

  it('fades while held when the recipe has a natural decay', () => {
    build(testVoice({ holdDecay: 2 }));
    expect(envelopeOf().gain.events.at(-1)).toMatchObject({ type: 'target', value: 0 });
  });

  it('pans low notes left and high notes right', () => {
    expect(panFor(36)).toBeLessThan(0);
    expect(panFor(96)).toBeGreaterThan(0);
    build(testVoice(), { midi: 36 });
    expect(ctx.panners[0].pan.value).toBeLessThan(0);
  });

  it('decays faster for higher notes', () => {
    expect(holdDecayFor(4, 84)).toBeLessThan(holdDecayFor(4, 60));
    expect(holdDecayFor(4, 60)).toBe(4);
  });

  it('wires an FM modulator into each carrier frequency', () => {
    build(getVoice('electric'));
    const carrier = partialOscillators(ctx)[0];
    expect(carrier.frequency.inputs.size).toBe(1);
  });

  it('wires vibrato into each oscillator detune', () => {
    build(getVoice('organ'));
    partialOscillators(ctx).forEach((osc) => expect(osc.detune.inputs.size).toBe(1));
  });

  it('adds a tremolo stage that modulates volume', () => {
    build(getVoice('vibraphone'));
    const tremolo = ctx.gainNodes.find((g) => g.gain.inputs.size > 0);
    expect(tremolo).toBeDefined();
  });

  it('plays a noise burst for hammer/pluck voices', () => {
    const noiseBuffer = ctx.createBuffer(1, 100, ctx.sampleRate) as unknown as AudioBuffer;
    build(getVoice('harpsichord'), { noiseBuffer });
    expect(ctx.bufferSources).toHaveLength(1);
    expect(ctx.bufferSources[0].stopTime).not.toBeNull();
  });

  describe('release', () => {
    it('fades from the current envelope level over the release time', () => {
      const voice = build(testVoice());
      voice.release(0.05);
      const events = envelopeOf().gain.events;

      // Halfway through the decay (0.01 + 0.04 of 0.1): level between peak and sustain
      const hold = events.find((e) => e.type === 'set' && e.time === 0.05)!;
      const peak = events[1].value!;
      expect(hold.value!).toBeLessThan(peak);
      expect(hold.value!).toBeGreaterThan(peak * 0.5);
      expect(events.at(-1)).toEqual({ type: 'linearRamp', value: 0, time: 0.45 });
      ctx.oscillators.forEach((o) => expect(o.stopTime).toBeCloseTo(0.5));
    });

    it('accepts a custom fade time and only releases once', () => {
      const voice = build(testVoice());
      voice.release(1, 0.015);
      voice.release(2);
      expect(voice.released).toBe(true);
      ctx.oscillators.forEach((o) => expect(o.stopTime).toBeCloseTo(1.065));
    });

    it('disconnects every node and reports when it has finished', () => {
      const voice = build(testVoice());
      let ended = false;
      voice.onEnded = () => (ended = true);
      voice.release(0);

      ctx.oscillators.at(-1)!.finish();

      expect(ended).toBe(true);
      expect(ctx.oscillators.every((o) => o.disconnected)).toBe(true);
      expect(ctx.filters[0].disconnected).toBe(true);
    });
  });

  it('connects its output to the destination', () => {
    build(testVoice());
    const panner = ctx.panners[0];
    expect(panner.connections.has(out)).toBe(true);
    expect(panner.pan).toBeInstanceOf(FakeAudioParam);
  });
});
