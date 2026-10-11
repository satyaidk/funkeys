import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Piano from './Piano';
import { generateNotes } from '@/lib/music/keyboard-map';

const notes = generateNotes();

function renderPiano(props: Partial<React.ComponentProps<typeof Piano>> = {}) {
  const onNoteOn = vi.fn();
  const onNoteOff = vi.fn();
  render(<Piano notes={notes} activeNoteIds={new Set()} onNoteOn={onNoteOn} onNoteOff={onNoteOff} {...props} />);
  return { onNoteOn, onNoteOff };
}

const key = (name: string) => screen.getByRole('button', { name });
const keyboard = () => screen.getByRole('group', { name: 'Piano keyboard' });

/**
 * jsdom has no layout, so `elementFromPoint` can't find what's under a
 * pointer. Tests decide it: the pointer is "over" whichever element is set.
 */
function stubPointerTarget() {
  let under: Element | null = null;
  const original = document.elementFromPoint;
  document.elementFromPoint = () => under;
  return {
    over: (el: Element | null) => {
      under = el;
    },
    restore: () => {
      document.elementFromPoint = original;
    },
  };
}

describe('Piano', () => {
  it('renders one key per note, labelled with its note name', () => {
    renderPiano();
    expect(screen.getAllByRole('button', { name: /^[A-G]#?\d$/ })).toHaveLength(37);
    expect(key('C3')).toBeInTheDocument();
    expect(key('F#4')).toBeInTheDocument();
    expect(key('C6')).toBeInTheDocument();
  });

  it('prints the computer key on each piano key', () => {
    renderPiano();
    expect(key('C3')).toHaveTextContent('Z');
    expect(key('F#4')).toHaveTextContent('2');
  });

  it('uses the layout labels from the browser when available', () => {
    renderPiano({ labels: new Map([['KeyZ', 'W']]) });
    expect(key('C3')).toHaveTextContent('W');
  });

  it('marks held keys as pressed', () => {
    renderPiano({ activeNoteIds: new Set(['E4']) });
    expect(key('E4')).toHaveAttribute('aria-pressed', 'true');
    expect(key('C4')).toHaveAttribute('aria-pressed', 'false');
  });

  it('starts a note on pointer down with a velocity, and stops it on pointer up', () => {
    const { onNoteOn, onNoteOff } = renderPiano();
    fireEvent.pointerDown(key('G4'), { button: 0 });
    expect(onNoteOn).toHaveBeenCalledWith('G4', expect.any(Number));
    const velocity = onNoteOn.mock.calls[0][1];
    expect(velocity).toBeGreaterThan(0);
    expect(velocity).toBeLessThanOrEqual(1);

    fireEvent.pointerUp(key('G4'));
    expect(onNoteOff).toHaveBeenCalledWith('G4');
  });

  describe('sliding, chords and safe release', () => {
    let pointer: ReturnType<typeof stubPointerTarget>;
    afterEach(() => pointer?.restore());

    it('plays each key a finger slides across (glissando)', () => {
      pointer = stubPointerTarget();
      const { onNoteOn, onNoteOff } = renderPiano();
      fireEvent.pointerDown(key('C4'), { button: 0, pointerId: 1 });
      pointer.over(key('D4'));
      fireEvent.pointerMove(keyboard(), { pointerId: 1 });
      pointer.over(key('E4'));
      fireEvent.pointerMove(keyboard(), { pointerId: 1 });
      fireEvent.pointerUp(keyboard(), { pointerId: 1 });

      expect(onNoteOn.mock.calls.map(([id]) => id)).toEqual(['C4', 'D4', 'E4']);
      expect(onNoteOff.mock.calls.map(([id]) => id)).toEqual(['C4', 'D4', 'E4']);
    });

    it('stops the note when the finger slides off the keys', () => {
      pointer = stubPointerTarget();
      const { onNoteOff } = renderPiano();
      fireEvent.pointerDown(key('G4'), { button: 0, pointerId: 1 });
      pointer.over(document.body);
      fireEvent.pointerMove(keyboard(), { pointerId: 1 });
      expect(onNoteOff).toHaveBeenCalledWith('G4');
    });

    it('plays a chord with several fingers, each released on its own', () => {
      const { onNoteOn, onNoteOff } = renderPiano();
      fireEvent.pointerDown(key('C4'), { button: 0, pointerId: 1 });
      fireEvent.pointerDown(key('E4'), { button: 0, pointerId: 2 });
      fireEvent.pointerDown(key('G4'), { button: 0, pointerId: 3 });
      expect(onNoteOn.mock.calls.map(([id]) => id)).toEqual(['C4', 'E4', 'G4']);

      fireEvent.pointerUp(keyboard(), { pointerId: 2 });
      expect(onNoteOff.mock.calls).toEqual([['E4']]);
    });

    it('stops the note when the browser cancels the pointer (e.g. a system gesture)', () => {
      const { onNoteOff } = renderPiano();
      fireEvent.pointerDown(key('A4'), { button: 0, pointerId: 4 });
      fireEvent.pointerCancel(keyboard(), { pointerId: 4 });
      expect(onNoteOff).toHaveBeenCalledWith('A4');
    });

    it('releases every finger when the window loses focus or the tab is hidden', () => {
      const { onNoteOff } = renderPiano();
      fireEvent.pointerDown(key('C4'), { button: 0, pointerId: 1 });
      fireEvent.blur(window);
      expect(onNoteOff).toHaveBeenCalledWith('C4');

      fireEvent.pointerDown(key('D4'), { button: 0, pointerId: 2 });
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      fireEvent(document, new Event('visibilitychange'));
      expect(onNoteOff).toHaveBeenCalledWith('D4');
    });

    // Regression: hovering across a key held on the computer keyboard used to stop it
    it('does not stop a note when a pointer that never pressed passes over the key', () => {
      const { onNoteOff } = renderPiano({ activeNoteIds: new Set(['G4']) });
      fireEvent.pointerMove(keyboard(), { pointerId: 9 });
      fireEvent.pointerLeave(key('G4'));
      expect(onNoteOff).not.toHaveBeenCalled();
    });
  });

  it('plays a short note when a screen reader activates a key', () => {
    vi.useFakeTimers();
    const { onNoteOn, onNoteOff } = renderPiano();
    fireEvent.click(key('B4'), { detail: 0 });
    expect(onNoteOn).toHaveBeenCalledWith('B4', expect.any(Number));
    act(() => vi.advanceTimersByTime(500));
    expect(onNoteOff).toHaveBeenCalledWith('B4');
    vi.useRealTimers();
  });

  it('lights keys sounding from playback', () => {
    renderPiano({ playbackNoteIds: new Set(['D5']) });
    expect(key('D5')).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the range and shifts the octave from the toolbar', () => {
    const onChange = vi.fn();
    renderPiano({ octave: { shift: 0, min: -2, max: 2, onChange } });
    expect(screen.getByLabelText('Keyboard range')).toHaveTextContent('C3–C6');
    fireEvent.click(screen.getByRole('button', { name: 'Octave up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Octave down' }));
    expect(onChange.mock.calls).toEqual([[1], [-1]]);
  });

  it('disables the octave buttons at the ends of the range', () => {
    renderPiano({ octave: { shift: 2, min: -2, max: 2, onChange: vi.fn() } });
    expect(screen.getByRole('button', { name: 'Octave up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Octave down' })).toBeEnabled();
  });

  it('ignores right-clicks', () => {
    const { onNoteOn } = renderPiano();
    fireEvent.pointerDown(key('G4'), { button: 2 });
    expect(onNoteOn).not.toHaveBeenCalled();
  });

  it('labels both hands in split mode', () => {
    renderPiano({ split: { index: 17, leftLabel: 'Electric piano', rightLabel: 'Concert grand' } });
    expect(screen.getByText(/Electric piano/)).toBeInTheDocument();
    expect(screen.getByText(/Concert grand/)).toBeInTheDocument();
  });
});
