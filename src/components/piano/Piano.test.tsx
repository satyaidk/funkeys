import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

describe('Piano', () => {
  it('renders one key per note, labelled with its note name', () => {
    renderPiano();
    expect(screen.getAllByRole('button')).toHaveLength(37);
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

  it('stops the note when the pointer slides off, or the browser cancels it', () => {
    const { onNoteOff } = renderPiano();
    fireEvent.pointerDown(key('G4'), { button: 0 });
    fireEvent.pointerLeave(key('G4'));
    fireEvent.pointerDown(key('A4'), { button: 0 });
    fireEvent.pointerCancel(key('A4'));
    expect(onNoteOff.mock.calls).toEqual([['G4'], ['A4']]);
  });

  // Regression: hovering across a key held on the computer keyboard used to stop it
  it('does not stop a note when the pointer just passes over the key', () => {
    const { onNoteOff } = renderPiano({ activeNoteIds: new Set(['G4']) });
    fireEvent.pointerLeave(key('G4'));
    expect(onNoteOff).not.toHaveBeenCalled();
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
