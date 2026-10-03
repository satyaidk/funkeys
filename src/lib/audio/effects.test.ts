import { describe, it, expect, beforeEach } from 'vitest';
import { createImpulseResponse, ReverbPreset } from './effects';
import { REVERB_PRESETS } from '../constants';
import { FakeAudioContext, installFakeAudioContext } from '@/test/fake-web-audio';

describe('createImpulseResponse', () => {
  let ctx: FakeAudioContext;

  beforeEach(() => {
    installFakeAudioContext();
    ctx = new FakeAudioContext();
  });

  const make = (preset: ReverbPreset = REVERB_PRESETS.hall, random = () => 1) =>
    createImpulseResponse(ctx as unknown as BaseAudioContext, preset, random);

  it('is stereo and as long as the pre-delay plus the tail', () => {
    const preset = REVERB_PRESETS.room;
    const buffer = make(preset);
    expect(buffer.numberOfChannels).toBe(2);
    expect(buffer.length).toBe(
      Math.floor(ctx.sampleRate * preset.preDelay) + Math.floor(ctx.sampleRate * preset.duration)
    );
  });

  it('is silent during the pre-delay, then loudest and fading', () => {
    const preset = REVERB_PRESETS.cathedral;
    const data = make(preset).getChannelData(0);
    const preDelay = Math.floor(ctx.sampleRate * preset.preDelay);

    expect(data[preDelay - 1]).toBe(0);
    expect(data[preDelay]).toBeCloseTo(1);
    expect(Math.abs(data[preDelay + 100])).toBeGreaterThan(Math.abs(data[data.length - 100]));
  });

  it('makes longer tails for bigger rooms', () => {
    expect(make(REVERB_PRESETS.cathedral).length).toBeGreaterThan(make(REVERB_PRESETS.room).length);
  });
});
