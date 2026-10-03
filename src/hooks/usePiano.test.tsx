import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, fireEvent, act } from '@testing-library/react';
import { usePiano } from './usePiano';
import { MAX_OCTAVE_SHIFT, DEFAULT_ENVELOPE } from '@/lib/constants';
import { installFakeAudioContext, latestAudioContext } from '@/test/fake-web-audio';

// Keyboard events are dispatched on `window`, exactly where the hooks listen.
// fireEvent wraps each dispatch in act(), so React state is updated afterwards.
const press = (key: string, code: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(window, { key, code, ...init });
const release = (key: string, code: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyUp(window, { key, code, ...init });
const tap = (key: string, code: string) => {
  press(key, code);
  release(key, code);
};
const toggleSustain = () => tap(' ', 'Space');

describe('usePiano', () => {
  beforeEach(() => installFakeAudioContext());

  describe('playing notes from the keyboard', () => {
    it('plays a note on key down and releases it on key up', () => {
      const { result } = renderHook(() => usePiano());

      press('a', 'KeyA');
      expect(result.current.activeNoteIds).toEqual(new Set(['C4']));
      expect(latestAudioContext().oscillators.length).toBeGreaterThan(0);

      release('a', 'KeyA');
      expect(result.current.activeNoteIds.size).toBe(0);
    });

    it('plays chords', () => {
      const { result } = renderHook(() => usePiano());
      press('a', 'KeyA');
      press('d', 'KeyD');
      press('g', 'KeyG');
      expect(result.current.activeNoteIds).toEqual(new Set(['C4', 'E4', 'G4']));
    });

    it('ignores auto-repeat while a key is held', () => {
      renderHook(() => usePiano());
      press('a', 'KeyA');
      const count = latestAudioContext().oscillators.length;

      press('a', 'KeyA', { repeat: true });
      expect(latestAudioContext().oscillators).toHaveLength(count);
    });

    it('ignores Ctrl / Cmd shortcuts', () => {
      const { result } = renderHook(() => usePiano());
      press('a', 'KeyA', { ctrlKey: true });
      press('s', 'KeyS', { metaKey: true });
      expect(result.current.activeNoteIds.size).toBe(0);
    });

    it('does not play while typing in a text field', () => {
      const { result } = renderHook(() => usePiano());
      const textField = document.body.appendChild(document.createElement('input'));

      fireEvent.keyDown(textField, { key: 'a', code: 'KeyA' });
      expect(result.current.activeNoteIds.size).toBe(0);
      textField.remove();
    });

    it('keeps playing while the volume slider is focused', () => {
      const { result } = renderHook(() => usePiano());
      const slider = document.body.appendChild(document.createElement('input'));
      slider.type = 'range';

      fireEvent.keyDown(slider, { key: 'a', code: 'KeyA' });
      expect(result.current.activeNoteIds).toEqual(new Set(['C4']));
      slider.remove();
    });

    // Regression: releasing ";" while holding Shift reports key ":" —
    // the note must still stop because the physical key (code) matches.
    it('releases the right note even if Shift changed the character', () => {
      const { result } = renderHook(() => usePiano());
      press(';', 'Semicolon');
      expect(result.current.activeNoteIds).toEqual(new Set(['E5']));

      release(':', 'Semicolon', { shiftKey: true });
      expect(result.current.activeNoteIds.size).toBe(0);
    });

    it('releases held notes when the window loses focus', () => {
      const { result } = renderHook(() => usePiano());
      press('a', 'KeyA');
      fireEvent.blur(window);
      expect(result.current.activeNoteIds.size).toBe(0);
    });
  });

  describe('octave shift', () => {
    it('moves up with X and down with Z', () => {
      const { result } = renderHook(() => usePiano());

      tap('x', 'KeyX');
      expect(result.current.config.octaveShift).toBe(1);
      expect(result.current.notes[0].id).toBe('C5');

      tap('z', 'KeyZ');
      tap('z', 'KeyZ');
      expect(result.current.config.octaveShift).toBe(-1);
    });

    it('stops at the maximum shift', () => {
      const { result } = renderHook(() => usePiano());
      for (let i = 0; i < MAX_OCTAVE_SHIFT + 3; i++) tap('x', 'KeyX');
      expect(result.current.config.octaveShift).toBe(MAX_OCTAVE_SHIFT);
    });

    it('does not react to Ctrl+Z / Ctrl+X (undo / cut)', () => {
      const { result } = renderHook(() => usePiano());
      press('z', 'KeyZ', { ctrlKey: true });
      press('x', 'KeyX', { ctrlKey: true });
      expect(result.current.config.octaveShift).toBe(0);
    });

    it('silences held notes, and their later key-up is ignored', () => {
      const { result } = renderHook(() => usePiano());
      press('a', 'KeyA');
      tap('x', 'KeyX');
      expect(result.current.activeNoteIds.size).toBe(0);

      release('a', 'KeyA');
      expect(result.current.activeNoteIds.size).toBe(0);
      expect(result.current.sustainedNoteIds.size).toBe(0);
    });
  });

  describe('sustain', () => {
    it('toggles with Space', () => {
      const { result } = renderHook(() => usePiano());
      toggleSustain();
      expect(result.current.config.sustain).toBe(true);
      toggleSustain();
      expect(result.current.config.sustain).toBe(false);
    });

    it('keeps released notes ringing until sustain is turned off', () => {
      const { result } = renderHook(() => usePiano());
      toggleSustain();
      tap('h', 'KeyH');

      expect(result.current.activeNoteIds.size).toBe(0);
      expect(result.current.sustainedNoteIds).toEqual(new Set(['A4']));
      expect(latestAudioContext().oscillators.every((o) => o.stopTime === null)).toBe(true);

      toggleSustain();
      expect(result.current.sustainedNoteIds.size).toBe(0);
      latestAudioContext().oscillators.forEach((osc) => {
        expect(osc.stopTime).toBeCloseTo(DEFAULT_ENVELOPE.release + 0.05);
      });
    });

    it('does not cut notes that are still held when sustain is turned off', () => {
      const { result } = renderHook(() => usePiano());
      toggleSustain();
      press('a', 'KeyA');
      tap('h', 'KeyH');
      toggleSustain();

      expect(result.current.activeNoteIds).toEqual(new Set(['C4']));
      expect(result.current.sustainedNoteIds.size).toBe(0);
    });

    it('lets a focused button handle Space itself', () => {
      const { result } = renderHook(() => usePiano());
      const button = document.body.appendChild(document.createElement('button'));

      fireEvent.keyDown(button, { key: ' ', code: 'Space' });
      expect(result.current.config.sustain).toBe(false);
      button.remove();
    });
  });

  describe('mouse / touch and volume handlers', () => {
    it('starts and stops notes by id', () => {
      const { result } = renderHook(() => usePiano());

      act(() => result.current.onNoteStart('E4'));
      expect(result.current.activeNoteIds).toEqual(new Set(['E4']));

      act(() => result.current.onNoteStop('E4'));
      expect(result.current.activeNoteIds.size).toBe(0);
    });

    it('clamps volume to 0–1', () => {
      const { result } = renderHook(() => usePiano());
      act(() => result.current.onVolumeChange(1.5));
      expect(result.current.config.volume).toBe(1);
      act(() => result.current.onVolumeChange(-0.2));
      expect(result.current.config.volume).toBe(0);
    });
  });
});
