import { describe, it, expect, beforeEach } from 'vitest';
import { NoteTracker } from './note-tracker';

describe('NoteTracker', () => {
  let tracker: NoteTracker;

  beforeEach(() => {
    tracker = new NoteTracker();
  });

  describe('without pedals', () => {
    it('stops a note when its key comes up', () => {
      expect(tracker.press('C4')).toBe(true);
      expect(tracker.heldIds.has('C4')).toBe(true);
      expect(tracker.release('C4')).toBe('stop');
      expect(tracker.heldIds.size).toBe(0);
    });

    it('ignores a second press of a held note', () => {
      tracker.press('C4');
      expect(tracker.press('C4')).toBe(false);
    });

    it('ignores releasing a note that was not held', () => {
      expect(tracker.release('C4')).toBe('ignore');
    });
  });

  describe('sustain pedal', () => {
    it('keeps released notes ringing until the pedal comes up', () => {
      tracker.setSustain(true);
      tracker.press('C4');
      expect(tracker.release('C4')).toBe('sustain');
      expect(tracker.ringingIds.has('C4')).toBe(true);

      expect(tracker.setSustain(false)).toEqual(['C4']);
      expect(tracker.ringingIds.size).toBe(0);
    });

    it('does not stop keys that are still held when the pedal comes up', () => {
      tracker.setSustain(true);
      tracker.press('C4');
      tracker.press('E4');
      tracker.release('E4');

      expect(tracker.setSustain(false)).toEqual(['E4']);
      expect(tracker.heldIds.has('C4')).toBe(true);
    });

    it('turns a ringing note back into a held one when pressed again', () => {
      tracker.setSustain(true);
      tracker.press('C4');
      tracker.release('C4');
      tracker.press('C4');
      expect(tracker.ringingIds.has('C4')).toBe(false);
      expect(tracker.heldIds.has('C4')).toBe(true);
    });
  });

  describe('sostenuto pedal', () => {
    it('holds only the notes that were down when it was pressed', () => {
      tracker.press('C3');
      tracker.setSostenuto(true);
      tracker.press('E4');

      expect(tracker.release('C3')).toBe('sustain');
      expect(tracker.release('E4')).toBe('stop');
    });

    it('releases its notes when it comes up', () => {
      tracker.press('C3');
      tracker.setSostenuto(true);
      tracker.release('C3');
      expect(tracker.setSostenuto(false)).toEqual(['C3']);
    });

    it('catches notes the sustain pedal was holding', () => {
      tracker.setSustain(true);
      tracker.press('C3');
      tracker.release('C3'); // ringing via sustain
      tracker.setSostenuto(true);

      expect(tracker.setSustain(false)).toEqual([]); // sostenuto still holds C3
      expect(tracker.setSostenuto(false)).toEqual(['C3']);
    });

    it('leaves notes ringing while the sustain pedal is still down', () => {
      tracker.press('C3');
      tracker.setSostenuto(true);
      tracker.setSustain(true);
      tracker.release('C3');

      expect(tracker.setSostenuto(false)).toEqual([]);
      expect(tracker.setSustain(false)).toEqual(['C3']);
    });
  });

  it('clears every note but keeps pedal positions', () => {
    tracker.setSustain(true);
    tracker.press('C4');
    tracker.clearNotes();
    expect(tracker.heldIds.size).toBe(0);

    tracker.press('D4');
    expect(tracker.release('D4')).toBe('sustain');
  });
});
