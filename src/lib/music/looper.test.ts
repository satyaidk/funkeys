import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Looper, LoopTarget } from './looper';
import { parseSequence } from './sequence';
import { midiToNoteId } from './notes';

/** At 120 BPM a beat is 500 ms, so this melody lasts 2 s: C4 at 0, E4 at 500, G4 at 1000 */
const MELODY = parseSequence('C4/4 E4/4 G4/2');
const BPM = 120;

/** A target that logs every press and release as "<time> on|off <note>" */
function recordingTarget() {
  const log: string[] = [];
  const target: LoopTarget = {
    noteOn: (noteId) => log.push(`${Date.now()} on ${noteId}`),
    noteOff: (noteId) => log.push(`${Date.now()} off ${noteId}`),
  };
  return { target, log };
}

describe('Looper', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => vi.useRealTimers());

  it('presses each note on time and lifts it after 90% of its length', () => {
    const { target, log } = recordingTarget();
    const looper = new Looper(target);
    looper.play(MELODY, BPM);
    vi.advanceTimersByTime(1999);

    expect(log).toEqual(['0 on C4', '450 off C4', '500 on E4', '950 off E4', '1000 on G4', '1900 off G4']);
    expect(looper.playing).toBe(true);
  });

  it('goes back to the first note at the end of each pass', () => {
    const { target, log } = recordingTarget();
    new Looper(target).play(MELODY, BPM);
    vi.advanceTimersByTime(6000);

    expect(log.filter((e) => e.endsWith('on C4'))).toEqual(['0 on C4', '2000 on C4', '4000 on C4', '6000 on C4']);
  });

  it('books the next pass from the timeline, so a late timer does not push the loop back', () => {
    const { target, log } = recordingTarget();
    new Looper(target).play(MELODY, BPM);
    vi.advanceTimersByTime(1850);
    vi.setSystemTime(Date.now() + 60); // the main thread was busy for 60 ms
    vi.advanceTimersByTime(200);

    expect(log).toContain('2000 on C4');
  });

  it('starts the pass over from now when it has fallen far behind', () => {
    const { target, log } = recordingTarget();
    new Looper(target).play(MELODY, BPM);
    vi.advanceTimersByTime(1850);
    vi.setSystemTime(Date.now() + 5000); // e.g. the tab was in the background
    vi.advanceTimersByTime(100);

    // The first pass, then one fresh start: not every missed note at once
    const presses = log.filter((e) => e.includes(' on '));
    expect(presses).toHaveLength(4);
    expect(presses.at(-1)).toMatch(/^69\d\d on C4$/);
  });

  it('stops, releasing the held note and cancelling the rest', () => {
    const { target, log } = recordingTarget();
    const looper = new Looper(target);
    looper.play(MELODY, BPM);
    vi.advanceTimersByTime(600);
    looper.stop();
    vi.advanceTimersByTime(5000);

    expect(log.slice(-2)).toEqual(['500 on E4', '600 off E4']);
    expect(looper.playing).toBe(false);
  });

  it('replaces the playing melody when asked to play another', () => {
    const { target, log } = recordingTarget();
    const looper = new Looper(target);
    looper.play(MELODY, BPM);
    vi.advanceTimersByTime(100);
    looper.play(parseSequence('A4/1'), BPM);
    vi.advanceTimersByTime(3000);

    expect(log).toEqual(['0 on C4', '100 off C4', '100 on A4', '1900 off A4', '2100 on A4']);
  });

  it('strikes a held note again instead of letting the piano ignore it', () => {
    const { target, log } = recordingTarget();
    new Looper(target).play(parseSequence('C4+C4/4 R/4'), BPM);
    vi.advanceTimersByTime(999);

    // The first press's release must not cut the second press short
    expect(log).toEqual(['0 on C4', '0 off C4', '0 on C4', '450 off C4']);
  });

  it('plays the keys chosen by noteIdFor', () => {
    const { target, log } = recordingTarget();
    new Looper(target, (midi) => midiToNoteId(midi + 12)).play(MELODY, BPM);
    vi.advanceTimersByTime(0);

    expect(log).toEqual(['0 on C5']);
  });
});
