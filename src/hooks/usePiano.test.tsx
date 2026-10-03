import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, fireEvent, act } from '@testing-library/react';
import { usePiano, UsePianoOptions } from './usePiano';
import { useAudioEngine } from './useAudioEngine';
import { MAX_OCTAVE_SHIFT } from '@/lib/constants';
import { getVoice } from '@/lib/audio/voices';
import {
  installFakeAudioContext,
  latestAudioContext,
  partialOscillators,
} from '@/test/fake-web-audio';

/** Render usePiano with a real (fake-backed) audio engine */
const renderPiano = (options: Partial<UsePianoOptions> = {}) =>
  renderHook(() => usePiano({ audio: useAudioEngine(), ...options }));

// Keyboard events are dispatched on `window`, exactly where the hooks listen.
// fireEvent wraps each dispatch in act(), so React state is updated afterwards.
const press = (code: string, init: KeyboardEventInit = {}) => fireEvent.keyDown(window, { code, ...init });
const release = (code: string, init: KeyboardEventInit = {}) => fireEvent.keyUp(window, { code, ...init });
const tap = (code: string) => {
  press(code);
  release(code);
};

describe('usePiano', () => {
  beforeEach(() => installFakeAudioContext());

  describe('playing from the computer keyboard', () => {
    it('plays a note on key down and stops it on key up', () => {
      const { result } = renderPiano();

      press('KeyZ');
      expect(result.current.activeNoteIds).toEqual(new Set(['C3']));
      expect(partialOscillators(latestAudioContext()).length).toBeGreaterThan(0);

      release('KeyZ');
      expect(result.current.activeNoteIds.size).toBe(0);
    });

    it('plays both manuals: number row is the upper black keys', () => {
      const { result } = renderPiano();
      press('Digit2');
      press('BracketRight');
      press('Semicolon');
      expect(result.current.activeNoteIds).toEqual(new Set(['F#4', 'C6', 'D#4']));
    });

    it('ignores auto-repeat while a key is held', () => {
      renderPiano();
      press('KeyQ');
      const count = latestAudioContext().oscillators.length;
      press('KeyQ', { repeat: true });
      expect(latestAudioContext().oscillators).toHaveLength(count);
    });

    it('ignores Ctrl / Cmd shortcuts', () => {
      const { result } = renderPiano();
      press('KeyC', { ctrlKey: true });
      press('KeyV', { metaKey: true });
      expect(result.current.activeNoteIds.size).toBe(0);
    });

    it('does not play while typing in a text field', () => {
      const { result } = renderPiano();
      const field = document.body.appendChild(document.createElement('input'));
      fireEvent.keyDown(field, { code: 'KeyQ', key: 'q' });
      expect(result.current.activeNoteIds.size).toBe(0);
      field.remove();
    });

    it('skips keys a focused control already handled', () => {
      const { result } = renderPiano();
      const event = new KeyboardEvent('keydown', { code: 'KeyQ', cancelable: true });
      event.preventDefault();
      act(() => {
        window.dispatchEvent(event);
      });
      expect(result.current.activeNoteIds.size).toBe(0);
    });

    // Regression: matching by physical key means Shift can't change the note
    it('plays the same note with Shift held (the soft pedal)', () => {
      const { result } = renderPiano();
      press('ShiftLeft');
      press('Digit2', { shiftKey: true, key: '@' });
      expect(result.current.activeNoteIds).toEqual(new Set(['F#4']));
      release('Digit2', { key: '2' });
      expect(result.current.activeNoteIds.size).toBe(0);
    });

    it('releases held notes when the window loses focus', () => {
      const { result } = renderPiano();
      press('KeyZ');
      fireEvent.blur(window);
      expect(result.current.activeNoteIds.size).toBe(0);
    });
  });

  describe('octave and transpose', () => {
    it('moves the keyboard with ← and →', () => {
      const { result } = renderPiano();
      tap('ArrowRight');
      expect(result.current.settings.octaveShift).toBe(1);
      expect(result.current.notes[0].id).toBe('C4');
      tap('ArrowLeft');
      tap('ArrowLeft');
      expect(result.current.settings.octaveShift).toBe(-1);
    });

    it('stops at the maximum shift', () => {
      const { result } = renderPiano();
      for (let i = 0; i < MAX_OCTAVE_SHIFT + 3; i++) tap('ArrowRight');
      expect(result.current.settings.octaveShift).toBe(MAX_OCTAVE_SHIFT);
    });

    it('silences held notes on an octave change, and ignores their later key-up', () => {
      const { result } = renderPiano();
      press('KeyZ');
      tap('ArrowRight');
      expect(result.current.activeNoteIds.size).toBe(0);
      release('KeyZ');
      expect(result.current.sustainedNoteIds.size).toBe(0);
    });

    it('transposes with ↑ and ↓, raising the sounding pitch', () => {
      const { result } = renderPiano();
      tap('ArrowUp');
      tap('ArrowUp');
      expect(result.current.settings.transpose).toBe(2);

      press('KeyE'); // A4 → sounds B4
      const fundamental = partialOscillators(latestAudioContext())[0].frequency.value;
      expect(fundamental).toBeCloseTo(440 * 2 ** (2 / 12), 0);
    });

    it('leaves Ctrl+arrow combinations to the browser', () => {
      const { result } = renderPiano();
      press('ArrowRight', { ctrlKey: true });
      expect(result.current.settings.octaveShift).toBe(0);
    });
  });

  describe('pedals', () => {
    it('sustains while Space is held, like a real pedal', () => {
      const { result } = renderPiano();
      press('Space');
      expect(result.current.pedals.sustain).toBe(true);

      tap('KeyN'); // A3
      expect(result.current.sustainedNoteIds).toEqual(new Set(['A3']));
      expect(partialOscillators(latestAudioContext()).every((o) => o.stopTime === null)).toBe(true);

      release('Space');
      expect(result.current.pedals.sustain).toBe(false);
      expect(result.current.sustainedNoteIds.size).toBe(0);
      partialOscillators(latestAudioContext()).forEach((o) => expect(o.stopTime).not.toBeNull());
    });

    it('does not cut notes that are still held when sustain lifts', () => {
      const { result } = renderPiano();
      press('Space');
      press('KeyZ');
      tap('KeyN');
      release('Space');
      expect(result.current.activeNoteIds).toEqual(new Set(['C3']));
    });

    it('latches the on-screen pedal on click', () => {
      const { result } = renderPiano();
      act(() => result.current.togglePedal('sustain'));
      expect(result.current.pedals.sustain).toBe(true);

      // Releasing Space doesn't lift a pedal the screen is holding
      tap('Space');
      expect(result.current.pedals.sustain).toBe(true);

      act(() => result.current.togglePedal('sustain'));
      expect(result.current.pedals.sustain).toBe(false);
    });

    it('holds only the notes down when the sostenuto pedal was pressed', () => {
      const { result } = renderPiano();
      press('KeyZ'); // C3 held
      act(() => result.current.setPedal('sostenuto', true));
      tap('KeyQ'); // F4 played afterwards
      release('KeyZ');

      expect(result.current.sustainedNoteIds).toEqual(new Set(['C3']));
    });

    it('applies the soft pedal while Shift is held', () => {
      const { result } = renderPiano();
      press('ShiftLeft');
      expect(result.current.pedals.soft).toBe(true);
      release('ShiftLeft');
      expect(result.current.pedals.soft).toBe(false);
    });

    it('lifts keyboard pedals when the window loses focus', () => {
      const { result } = renderPiano();
      press('Space');
      fireEvent.blur(window);
      expect(result.current.pedals.sustain).toBe(false);
    });

    it('lets a focused button handle Space itself', () => {
      const { result } = renderPiano();
      const button = document.body.appendChild(document.createElement('button'));
      fireEvent.keyDown(button, { code: 'Space', key: ' ' });
      expect(result.current.pedals.sustain).toBe(false);
      button.remove();
    });
  });

  describe('voices', () => {
    it('stacks a second voice in layer mode', () => {
      const { result } = renderPiano();
      act(() => result.current.updateSettings({ mode: 'layer', voice: 'organ', layerVoice: 'vibraphone' }));
      press('KeyQ');
      const expected = getVoice('organ').partials.length + getVoice('vibraphone').partials.length;
      expect(partialOscillators(latestAudioContext())).toHaveLength(expected);
    });

    it('uses the left-hand voice below the split point', () => {
      const { result } = renderPiano();
      act(() => result.current.updateSettings({ mode: 'split', voice: 'organ', splitVoice: 'vibraphone', splitIndex: 17 }));

      press('KeyZ'); // lower manual → vibraphone (3 partials)
      expect(partialOscillators(latestAudioContext())).toHaveLength(getVoice('vibraphone').partials.length);
    });
  });

  describe('settings and pointer input', () => {
    it('starts and stops notes by id', () => {
      const { result } = renderPiano();
      act(() => result.current.noteOn('E4', 0.9));
      expect(result.current.activeNoteIds).toEqual(new Set(['E4']));
      act(() => result.current.noteOff('E4'));
      expect(result.current.activeNoteIds.size).toBe(0);
    });

    it('validates every setting', () => {
      const { result } = renderPiano();
      act(() => result.current.updateSettings({ volume: 1.5, transpose: 30, referencePitch: 300 }));
      expect(result.current.settings).toMatchObject({ volume: 1, transpose: 12, referencePitch: 415.3 });
    });

    it('reports note and pedal actions for the recorder', () => {
      const onPerformanceAction = vi.fn();
      renderPiano({ onPerformanceAction });
      tap('KeyZ');
      press('Space');

      expect(onPerformanceAction.mock.calls.map(([a]) => a.type)).toEqual(['noteOn', 'noteOff', 'pedal']);
      expect(onPerformanceAction).toHaveBeenCalledWith({ type: 'pedal', pedal: 'sustain', down: true });
    });

    it('silences everything with releaseAll', () => {
      const { result } = renderPiano();
      press('KeyZ');
      press('KeyX');
      act(() => result.current.releaseAll());
      expect(result.current.activeNoteIds.size).toBe(0);
    });
  });
});
