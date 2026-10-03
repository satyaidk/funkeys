import { describe, it, expect, beforeEach } from 'vitest';
import { AudioEngine } from './audio-engine';
import {
  DEFAULT_ENVELOPE,
  DEFAULT_VOLUME,
  HARMONIC_RATIOS,
  QUICK_RELEASE,
} from './constants';
import {
  installFakeAudioContext,
  latestAudioContext,
  FakeAudioContext,
  FakeGainNode,
  FakeOscillatorNode,
} from '@/test/fake-web-audio';

/** Follow an oscillator's connections to the per-note ADSR gain node */
function noteGainOf(osc: FakeOscillatorNode): FakeGainNode {
  const [harmonicGain] = [...osc.connections];
  const [noteGain] = [...harmonicGain.connections];
  return noteGain as FakeGainNode;
}

describe('AudioEngine', () => {
  let engine: AudioEngine;

  beforeEach(() => {
    installFakeAudioContext();
    engine = new AudioEngine();
  });

  describe('init', () => {
    it('does not create an AudioContext until init() is called', () => {
      engine.playNote('C4', 261.63);
      expect(FakeAudioContext.instances).toHaveLength(0);
    });

    it('creates the context once and resumes it if suspended', () => {
      engine.init();
      engine.init();

      expect(FakeAudioContext.instances).toHaveLength(1);
      const ctx = latestAudioContext();
      expect(ctx.resume).toHaveBeenCalledTimes(1);
      expect(ctx.state).toBe('running');
    });

    it('routes master gain → compressor → speakers', () => {
      engine.init();
      const ctx = latestAudioContext();
      const [masterGain] = ctx.gainNodes;
      const [compressor] = ctx.compressors;

      expect(masterGain.connections.has(compressor)).toBe(true);
      expect(compressor.connections.has(ctx.destination)).toBe(true);
    });

    it('applies a volume set before init', () => {
      engine.setVolume(0.3);
      engine.init();
      const [masterGain] = latestAudioContext().gainNodes;
      expect(masterGain.gain.value).toBe(0.3);
    });

    it('uses the default volume otherwise', () => {
      engine.init();
      const [masterGain] = latestAudioContext().gainNodes;
      expect(masterGain.gain.value).toBe(DEFAULT_VOLUME);
    });
  });

  describe('playNote', () => {
    beforeEach(() => engine.init());

    it('creates one oscillator per harmonic at multiples of the frequency', () => {
      engine.playNote('A4', 440);
      const { oscillators } = latestAudioContext();

      expect(oscillators).toHaveLength(HARMONIC_RATIOS.length);
      oscillators.forEach((osc, i) => {
        expect(osc.frequency.value).toBe(440 * HARMONIC_RATIOS[i]);
        expect(osc.startTime).toBe(0);
      });
      expect(oscillators[0].type).toBe('triangle');
      expect(oscillators.slice(1).every((o) => o.type === 'sine')).toBe(true);
    });

    it('shapes the attack and decay with the ADSR envelope', () => {
      engine.playNote('A4', 440);
      const gain = noteGainOf(latestAudioContext().oscillators[0]).gain;
      const { attack, decay, sustain } = DEFAULT_ENVELOPE;

      expect(gain.events).toEqual([
        { type: 'set', value: 0, time: 0 },
        { type: 'linearRamp', value: 1, time: attack },
        { type: 'linearRamp', value: sustain, time: attack + decay },
      ]);
    });

    it('tracks the note as playing', () => {
      engine.playNote('A4', 440);
      expect(engine.isNotePlaying('A4')).toBe(true);
    });

    it('quickly fades out a still-held voice when the same note is replayed', () => {
      const ctx = latestAudioContext();
      engine.playNote('A4', 440);
      const firstVoice = ctx.oscillators.slice(0, HARMONIC_RATIOS.length);

      ctx.currentTime = 1;
      engine.playNote('A4', 440);

      firstVoice.forEach((osc) => {
        expect(osc.stopTime).toBeCloseTo(1 + QUICK_RELEASE + 0.05);
      });
      expect(ctx.oscillators).toHaveLength(HARMONIC_RATIOS.length * 2);
      expect(engine.isNotePlaying('A4')).toBe(true);
    });
  });

  describe('stopNote', () => {
    beforeEach(() => engine.init());

    it('ramps to silence over the release time and schedules oscillator stop', () => {
      const ctx = latestAudioContext();
      engine.playNote('A4', 440);
      ctx.currentTime = 2;
      engine.stopNote('A4');

      const gain = noteGainOf(ctx.oscillators[0]).gain;
      expect(gain.events.at(-1)).toEqual({
        type: 'linearRamp',
        value: 0,
        time: 2 + DEFAULT_ENVELOPE.release,
      });
      ctx.oscillators.forEach((osc) => {
        expect(osc.stopTime).toBeCloseTo(2 + DEFAULT_ENVELOPE.release + 0.05);
      });
      expect(engine.isNotePlaying('A4')).toBe(false);
    });

    it('releases from the level the envelope has actually reached', () => {
      const ctx = latestAudioContext();
      const { attack, decay, sustain } = DEFAULT_ENVELOPE;
      engine.playNote('A4', 440);

      // Halfway through the decay phase
      ctx.currentTime = attack + decay / 2;
      engine.stopNote('A4');

      const gain = noteGainOf(ctx.oscillators[0]).gain;
      const hold = gain.events.find((e) => e.type === 'set' && e.time === ctx.currentTime);
      expect(hold?.value).toBeCloseTo(1 - (1 - sustain) / 2);
    });

    it('disconnects the voice once it has finished', () => {
      const ctx = latestAudioContext();
      engine.playNote('A4', 440);
      const noteGain = noteGainOf(ctx.oscillators[0]);
      const filter = ctx.filters[0];
      engine.stopNote('A4');

      ctx.oscillators[0].finish();

      expect(ctx.oscillators.every((o) => o.disconnected)).toBe(true);
      expect(noteGain.disconnected).toBe(true);
      expect(filter.disconnected).toBe(true);
    });

    it('ignores notes that are not playing', () => {
      expect(() => engine.stopNote('C4')).not.toThrow();
    });

    // Regression test: a delayed cleanup timer used to delete the *new*
    // voice when a note was replayed during its release, so the next
    // key-up couldn't find it and the note rang forever.
    it('can stop a note that was replayed during its release tail', () => {
      const ctx = latestAudioContext();
      engine.playNote('A4', 440);
      engine.stopNote('A4');

      ctx.currentTime = 0.3; // still inside the 0.8s release
      engine.playNote('A4', 440);
      const secondVoice = ctx.oscillators.slice(HARMONIC_RATIOS.length);

      ctx.currentTime = 5;
      engine.stopNote('A4');

      secondVoice.forEach((osc) => expect(osc.stopTime).not.toBeNull());
      expect(engine.isNotePlaying('A4')).toBe(false);
    });
  });

  describe('stopAllNotes / destroy', () => {
    beforeEach(() => engine.init());

    it('quickly stops every held note', () => {
      engine.playNote('C4', 261.63);
      engine.playNote('E4', 329.63);
      engine.stopAllNotes();

      expect(engine.isNotePlaying('C4')).toBe(false);
      expect(engine.isNotePlaying('E4')).toBe(false);
      latestAudioContext().oscillators.forEach((osc) => {
        expect(osc.stopTime).toBeCloseTo(QUICK_RELEASE + 0.05);
      });
    });

    it('closes the AudioContext on destroy', () => {
      const ctx = latestAudioContext();
      engine.destroy();
      expect(ctx.close).toHaveBeenCalled();
    });
  });

  describe('setVolume', () => {
    it('clamps to the 0–1 range', () => {
      engine.init();
      const [masterGain] = latestAudioContext().gainNodes;

      engine.setVolume(2);
      expect(masterGain.gain.value).toBe(1);
      engine.setVolume(-1);
      expect(masterGain.gain.value).toBe(0);
    });
  });
});
