import { describe, it, expect, beforeEach } from 'vitest';
import { AudioEngine } from './audio-engine';
import { getVoice } from './voices';
import {
  BRILLIANCE_GAIN_DB,
  DEFAULT_REVERB_LEVEL,
  DEFAULT_VOLUME,
  MAX_POLYPHONY,
  QUICK_RELEASE,
} from '../constants';
import { PlayNoteOptions } from '@/types';
import {
  installFakeAudioContext,
  latestAudioContext,
  FakeAudioContext,
  partialOscillators,
} from '@/test/fake-web-audio';

const grand: PlayNoteOptions = { voices: [{ voice: 'grand', gain: 1 }], velocity: 0.8, midi: 69 };
const grandPartials = getVoice('grand').partials.length;

/** Gain nodes in creation order: compressor chain is built first in init() */
const masterGainOf = (ctx: FakeAudioContext) => ctx.gainNodes[0];

describe('AudioEngine', () => {
  let engine: AudioEngine;

  beforeEach(() => {
    installFakeAudioContext();
    engine = new AudioEngine();
  });

  describe('init', () => {
    it('does not create an AudioContext until init() is called', () => {
      engine.playNote('A4', 440, grand);
      expect(FakeAudioContext.instances).toHaveLength(0);
    });

    it('creates the context once and resumes it if suspended', () => {
      engine.init();
      engine.init();
      expect(FakeAudioContext.instances).toHaveLength(1);
      expect(latestAudioContext().resume).toHaveBeenCalledTimes(1);
    });

    it('routes the master gain through a compressor to the speakers', () => {
      engine.init();
      const ctx = latestAudioContext();
      const [compressor] = ctx.compressors;
      expect(masterGainOf(ctx).connections.has(compressor)).toBe(true);
      expect(compressor.connections.has(ctx.destination)).toBe(true);
    });

    it('applies settings chosen before init', () => {
      engine.setVolume(0.3);
      engine.setBrilliance('bright');
      engine.setReverb('room', 0.5);
      engine.init();
      const ctx = latestAudioContext();

      expect(masterGainOf(ctx).gain.value).toBe(0.3);
      expect(ctx.filters[0].gain.value).toBe(BRILLIANCE_GAIN_DB.bright);
      expect(ctx.convolvers[0].buffer).not.toBeNull();
    });

    it('uses sensible defaults', () => {
      engine.init();
      const ctx = latestAudioContext();
      expect(masterGainOf(ctx).gain.value).toBe(DEFAULT_VOLUME);
      const reverbSend = ctx.gainNodes.find((g) => g.connections.has(ctx.convolvers[0]))!;
      expect(reverbSend.gain.value).toBe(DEFAULT_REVERB_LEVEL);
    });
  });

  describe('playNote', () => {
    beforeEach(() => engine.init());

    it('builds one voice from the recipe and tracks the note', () => {
      engine.playNote('A4', 440, grand);
      expect(partialOscillators(latestAudioContext())).toHaveLength(grandPartials);
      expect(engine.isNotePlaying('A4')).toBe(true);
      expect(engine.voiceCount).toBe(1);
    });

    it('builds one voice per layer', () => {
      engine.playNote('A4', 440, {
        ...grand,
        voices: [{ voice: 'grand', gain: 1 }, { voice: 'strings', gain: 1 }],
      });
      expect(engine.voiceCount).toBe(2);
    });

    it('quickly fades a still-held voice when the same note is replayed', () => {
      const ctx = latestAudioContext();
      engine.playNote('A4', 440, grand);
      const first = partialOscillators(ctx);
      ctx.currentTime = 1;
      engine.playNote('A4', 440, grand);

      first.forEach((osc) => expect(osc.stopTime).toBeCloseTo(1 + QUICK_RELEASE + 0.05));
      expect(engine.isNotePlaying('A4')).toBe(true);
    });

    it('fades out the oldest voices beyond the polyphony limit', () => {
      const ctx = latestAudioContext();
      for (let i = 0; i < MAX_POLYPHONY + 1; i++) {
        engine.playNote(`n${i}`, 440, { ...grand, voices: [{ voice: 'organ', gain: 1 }] });
      }
      expect(engine.voiceCount).toBe(MAX_POLYPHONY);
      // The first note's oscillators were told to stop
      expect(ctx.oscillators[1].stopTime).not.toBeNull();
    });
  });

  describe('stopNote', () => {
    beforeEach(() => engine.init());

    it('releases every voice of the note and forgets it', () => {
      const ctx = latestAudioContext();
      engine.playNote('A4', 440, grand);
      ctx.currentTime = 2;
      engine.stopNote('A4');

      const release = getVoice('grand').envelope.release;
      partialOscillators(ctx).forEach((osc) => expect(osc.stopTime).toBeCloseTo(2 + release + 0.05));
      expect(engine.isNotePlaying('A4')).toBe(false);
    });

    it('frees the voice once it has finished', () => {
      const ctx = latestAudioContext();
      engine.playNote('A4', 440, grand);
      engine.stopNote('A4');
      ctx.oscillators.at(-1)!.finish();
      expect(engine.voiceCount).toBe(0);
    });

    it('ignores notes that are not playing', () => {
      expect(() => engine.stopNote('C4')).not.toThrow();
    });

    // Regression: a delayed cleanup once deleted the *new* voice when a note
    // was replayed during its release, so it could never be stopped.
    it('can stop a note that was replayed during its release tail', () => {
      const ctx = latestAudioContext();
      engine.playNote('A4', 440, grand);
      engine.stopNote('A4');
      ctx.currentTime = 0.2;
      engine.playNote('A4', 440, grand);
      const second = partialOscillators(ctx).slice(grandPartials);

      ctx.currentTime = 5;
      engine.stopNote('A4');
      second.forEach((osc) => expect(osc.stopTime).not.toBeNull());
      expect(engine.isNotePlaying('A4')).toBe(false);
    });

    it('quickly stops every held note', () => {
      engine.playNote('C4', 261.63, grand);
      engine.playNote('E4', 329.63, grand);
      engine.stopAllNotes();
      expect(engine.isNotePlaying('C4')).toBe(false);
      partialOscillators(latestAudioContext()).forEach((osc) =>
        expect(osc.stopTime).toBeCloseTo(QUICK_RELEASE + 0.05)
      );
    });
  });

  describe('effects and settings', () => {
    beforeEach(() => engine.init());

    it('turns the reverb send off and on', () => {
      const ctx = latestAudioContext();
      const send = ctx.gainNodes.find((g) => g.connections.has(ctx.convolvers[0]))!;
      engine.setReverb('off', 0.5);
      expect(send.gain.value).toBe(0);
      engine.setReverb('cathedral', 0.6);
      expect(send.gain.value).toBe(0.6);
    });

    it('generates each impulse response only once', () => {
      const ctx = latestAudioContext();
      const count = ctx.buffers.length; // noise + the default hall, built by init()
      engine.setReverb('room', 0.3); // new room → generated
      engine.setReverb('hall', 0.3); // cached
      engine.setReverb('room', 0.3); // cached
      expect(ctx.buffers.length).toBe(count + 1);
    });

    it('changes brilliance with the high-shelf gain', () => {
      engine.setBrilliance('mellow');
      expect(latestAudioContext().filters[0].gain.value).toBe(BRILLIANCE_GAIN_DB.mellow);
    });

    it('clamps volume to 0–1', () => {
      const master = masterGainOf(latestAudioContext());
      engine.setVolume(2);
      expect(master.gain.value).toBe(1);
      engine.setVolume(-1);
      expect(master.gain.value).toBe(0);
    });
  });

  describe('metronome clicks', () => {
    it('schedules a short click at the exact time, higher when accented', () => {
      engine.init();
      const ctx = latestAudioContext();
      engine.scheduleClick(2, true);
      engine.scheduleClick(2.5, false);
      const [accent, normal] = ctx.oscillators;

      expect(accent.startTime).toBe(2);
      expect(accent.stopTime).toBeCloseTo(2.07);
      expect(accent.frequency.value).toBeGreaterThan(normal.frequency.value);
    });

    it('does nothing before init', () => {
      expect(() => engine.scheduleClick(1, true)).not.toThrow();
    });
  });

  it('closes the AudioContext on destroy', () => {
    engine.init();
    const ctx = latestAudioContext();
    engine.destroy();
    expect(ctx.close).toHaveBeenCalled();
  });
});
