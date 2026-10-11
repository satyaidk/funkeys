import { describe, it, expect } from 'vitest';
import { PointerTracker } from './pointer-tracker';

describe('PointerTracker', () => {
  it('starts a note when a pointer goes down on a key and stops it when it lifts', () => {
    const t = new PointerTracker();
    expect(t.move(1, 'C4')).toEqual({ start: 'C4', stop: null });
    expect(t.has(1)).toBe(true);
    expect(t.release(1)).toBe('C4');
    expect(t.has(1)).toBe(false);
  });

  it('plays a chord with several fingers', () => {
    const t = new PointerTracker();
    expect(t.move(1, 'C4').start).toBe('C4');
    expect(t.move(2, 'E4').start).toBe('E4');
    expect(t.move(3, 'G4').start).toBe('G4');
    expect(t.size).toBe(3);
    expect(t.release(2)).toBe('E4');
  });

  it('slides from key to key (glissando): stop the old note, start the new one', () => {
    const t = new PointerTracker();
    t.move(1, 'C4');
    expect(t.move(1, 'D4')).toEqual({ start: 'D4', stop: 'C4' });
    expect(t.move(1, 'D4')).toEqual({ start: null, stop: null }); // moving within a key
  });

  it('stops the note when a finger slides off the keys, and plays again when it slides back', () => {
    const t = new PointerTracker();
    t.move(1, 'C4');
    expect(t.move(1, null)).toEqual({ start: null, stop: 'C4' });
    expect(t.has(1)).toBe(true); // still pressing, just not on a key
    expect(t.move(1, 'C4')).toEqual({ start: 'C4', stop: null });
  });

  it('keeps a note sounding until the last finger on it lifts', () => {
    const t = new PointerTracker();
    t.move(1, 'C4');
    expect(t.move(2, 'C4').start).toBeNull(); // already sounding
    expect(t.release(1)).toBeNull(); // finger 2 still holds it
    expect(t.release(2)).toBe('C4');
  });

  it('ignores pointers it never saw go down', () => {
    expect(new PointerTracker().release(7)).toBeNull();
  });

  it('releases everything at once, each note once', () => {
    const t = new PointerTracker();
    t.move(1, 'C4');
    t.move(2, 'C4');
    t.move(3, 'G4');
    expect(t.releaseAll().sort()).toEqual(['C4', 'G4']);
    expect(t.size).toBe(0);
  });
});
