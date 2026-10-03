import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Piano from './Piano';
import { generateNotes } from '@/lib/notes';
import { PianoProps } from '@/types';

const notes = generateNotes();

function renderPiano(props: Partial<PianoProps> = {}) {
  const onNoteStart = vi.fn();
  const onNoteStop = vi.fn();
  render(
    <Piano
      notes={notes}
      activeNoteIds={new Set()}
      onNoteStart={onNoteStart}
      onNoteStop={onNoteStop}
      {...props}
    />
  );
  return { onNoteStart, onNoteStop };
}

const key = (name: string) => screen.getByRole('button', { name });

describe('Piano', () => {
  it('renders one key per note, labelled with its note name', () => {
    renderPiano();
    expect(screen.getAllByRole('button')).toHaveLength(notes.length);
    expect(key('C4')).toBeInTheDocument();
    expect(key('C#4')).toBeInTheDocument();
    expect(key('E5')).toBeInTheDocument();
  });

  it('shows the computer key for each piano key', () => {
    renderPiano();
    expect(key('C4')).toHaveTextContent('A');
    expect(key('C#4')).toHaveTextContent('W');
  });

  it('marks held keys as pressed', () => {
    renderPiano({ activeNoteIds: new Set(['E4']) });
    expect(key('E4')).toHaveAttribute('aria-pressed', 'true');
    expect(key('C4')).toHaveAttribute('aria-pressed', 'false');
  });

  it('starts a note on pointer down and stops it on pointer up', () => {
    const { onNoteStart, onNoteStop } = renderPiano();

    fireEvent.pointerDown(key('G4'), { button: 0 });
    expect(onNoteStart).toHaveBeenCalledWith('G4');

    fireEvent.pointerUp(key('G4'));
    expect(onNoteStop).toHaveBeenCalledWith('G4');
  });

  it('stops the note when the pointer slides off a pressed key', () => {
    const { onNoteStop } = renderPiano();
    fireEvent.pointerDown(key('G4'), { button: 0 });
    fireEvent.pointerLeave(key('G4'));
    expect(onNoteStop).toHaveBeenCalledWith('G4');
  });

  // Regression: hovering across a key that is held via the computer
  // keyboard used to stop its note.
  it('does not stop a note when the pointer just passes over the key', () => {
    const { onNoteStop } = renderPiano({ activeNoteIds: new Set(['G4']) });
    fireEvent.pointerLeave(key('G4'));
    expect(onNoteStop).not.toHaveBeenCalled();
  });

  it('ignores right-clicks', () => {
    const { onNoteStart } = renderPiano();
    fireEvent.pointerDown(key('G4'), { button: 2 });
    expect(onNoteStart).not.toHaveBeenCalled();
  });

  it('stops the note if the browser cancels the pointer', () => {
    const { onNoteStop } = renderPiano();
    fireEvent.pointerDown(key('A4'), { button: 0 });
    fireEvent.pointerCancel(key('A4'));
    expect(onNoteStop).toHaveBeenCalledWith('A4');
  });
});
