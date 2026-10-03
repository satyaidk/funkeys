import { describe, it, expect } from 'vitest';
import { getVoice, resolveVoices, VoiceRouting, VOICES } from './voices';

const routing = (overrides: Partial<VoiceRouting> = {}): VoiceRouting => ({
  voice: 'grand',
  mode: 'single',
  layerVoice: 'strings',
  layerBalance: 0.5,
  splitVoice: 'electric',
  splitIndex: 17,
  ...overrides,
});

describe('voice recipes', () => {
  it('defines 8 voices with unique ids', () => {
    expect(VOICES).toHaveLength(8);
    expect(new Set(VOICES.map((v) => v.id)).size).toBe(8);
  });

  it.each(VOICES.map((v) => [v.name, v] as const))('%s is a valid recipe', (_, voice) => {
    expect(voice.partials.length).toBeGreaterThan(0);
    voice.partials.forEach((p) => {
      expect(p.ratio).toBeGreaterThan(0);
      expect(p.gain).toBeGreaterThan(0);
    });
    expect(voice.envelope.attack).toBeGreaterThan(0);
    expect(voice.envelope.release).toBeGreaterThan(0);
    expect(voice.envelope.sustain).toBeGreaterThan(0);
    expect(voice.envelope.sustain).toBeLessThanOrEqual(1);
    expect(voice.gain).toBeGreaterThan(0);
    expect(voice.name.length).toBeGreaterThan(0);
  });

  it('looks voices up by id, falling back to the grand piano', () => {
    expect(getVoice('organ').name).toBe('Drawbar organ');
    expect(getVoice('nope' as never).id).toBe('grand');
  });

  it('makes piano-like voices fade while held, but not the organ', () => {
    expect(getVoice('grand').holdDecay).toBeDefined();
    expect(getVoice('organ').holdDecay).toBeUndefined();
  });
});

describe('resolveVoices', () => {
  it('plays the main voice in single mode', () => {
    expect(resolveVoices(routing(), 5)).toEqual([{ voice: 'grand', gain: 1 }]);
  });

  it('stacks two voices at full level in layer mode at balance 0.5', () => {
    expect(resolveVoices(routing({ mode: 'layer' }), 5)).toEqual([
      { voice: 'grand', gain: 1 },
      { voice: 'strings', gain: 1 },
    ]);
  });

  it('fades the other voice as the balance moves toward one side', () => {
    expect(resolveVoices(routing({ mode: 'layer', layerBalance: 0.25 }), 5)).toEqual([
      { voice: 'grand', gain: 1 },
      { voice: 'strings', gain: 0.5 },
    ]);
    expect(resolveVoices(routing({ mode: 'layer', layerBalance: 1 }), 5)).toEqual([
      { voice: 'strings', gain: 1 },
    ]);
  });

  it('uses the split voice left of the split point in split mode', () => {
    const split = routing({ mode: 'split', splitIndex: 17 });
    expect(resolveVoices(split, 16)).toEqual([{ voice: 'electric', gain: 1 }]);
    expect(resolveVoices(split, 17)).toEqual([{ voice: 'grand', gain: 1 }]);
  });
});
