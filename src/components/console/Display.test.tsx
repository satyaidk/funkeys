import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Display, { formatTime } from './Display';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import { PianoSettings } from '@/types';

const metronome = { running: false, bpm: 96, timeSignature: '4/4', beat: null, beatsPerBar: 4 };
const recorder = { status: 'idle' as const, elapsed: 0, duration: 0 };
const pedals = { soft: false, sostenuto: false, sustain: false };

function renderDisplay(overrides: Partial<PianoSettings> = {}, extra: Partial<React.ComponentProps<typeof Display>> = {}) {
  render(
    <Display
      settings={{ ...DEFAULT_SETTINGS, ...overrides }}
      pedals={pedals}
      soundingNotes={[]}
      metronome={metronome}
      recorder={recorder}
      {...extra}
    />
  );
  return screen.getByRole('group', { name: 'Display' });
}

describe('Display', () => {
  it('shows the voice and the current settings', () => {
    const display = renderDisplay();
    expect(display).toHaveTextContent('Concert grand');
    expect(display).toHaveTextContent('Single voice');
    expect(display).toHaveTextContent('A4 440.0 Hz');
    expect(display).toHaveTextContent('♩ 96');
  });

  it('shows both voices in layer and split modes', () => {
    expect(renderDisplay({ mode: 'layer', layerVoice: 'strings' })).toHaveTextContent('+ String ensemble');
  });

  it('names the left-hand voice in split mode', () => {
    expect(renderDisplay({ mode: 'split', splitVoice: 'electric' })).toHaveTextContent('Left hand: Electric piano');
  });

  it('shows tuning changes, including the temperament key', () => {
    const display = renderDisplay({ transpose: -3, referencePitch: 442, temperament: 'werckmeister', temperamentRoot: 7 });
    expect(display).toHaveTextContent('Transpose -3');
    expect(display).toHaveTextContent('A4 442.0 Hz');
    expect(display).toHaveTextContent('Werckmeister III in G');
  });

  it('lists the sounding notes', () => {
    renderDisplay({}, { soundingNotes: ['C4', 'E4', 'G4'] });
    expect(screen.getByLabelText('Now playing')).toHaveTextContent('C4 E4 G4');
  });

  it('shows the recorder state', () => {
    expect(renderDisplay({}, { recorder: { status: 'recording', elapsed: 65000, duration: 0 } })).toHaveTextContent('Rec 1:05');
  });

  it('formats times as minutes and seconds', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(9500)).toBe('0:09');
    expect(formatTime(125000)).toBe('2:05');
  });
});
