import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  clampBpm,
  MetronomeClock,
  MetronomeScheduler,
  tempoFromTaps,
  tempoMarking,
  TIME_SIGNATURES,
} from './metronome';

const fourFour = TIME_SIGNATURES.find((t) => t.id === '4/4')!;
const sixEight = TIME_SIGNATURES.find((t) => t.id === '6/8')!;

/** A controllable audio clock that records booked clicks */
function fakeClock() {
  const clicks: Array<{ time: number; accent: boolean }> = [];
  const clock: MetronomeClock & { currentTime: number } = {
    currentTime: 0,
    scheduleClick: (time, accent) => clicks.push({ time, accent }),
  };
  return { clock, clicks };
}

describe('MetronomeScheduler', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('books clicks exactly one beat apart on the audio clock', () => {
    const { clock, clicks } = fakeClock();
    const metronome = new MetronomeScheduler(clock, { bpm: 120, timeSignature: fourFour });
    metronome.start();

    // Advance both clocks by 2 seconds in 25 ms steps
    for (let t = 0; t < 2; t += 0.025) {
      clock.currentTime = t;
      vi.advanceTimersByTime(25);
    }

    const times = clicks.map((c) => c.time);
    expect(times.length).toBeGreaterThanOrEqual(4);
    times.slice(1).forEach((time, i) => expect(time - times[i]).toBeCloseTo(0.5));
    metronome.stop();
  });

  it('accents the first beat of every bar', () => {
    const { clock, clicks } = fakeClock();
    const metronome = new MetronomeScheduler(clock, { bpm: 240, timeSignature: fourFour });
    metronome.start();
    for (let t = 0; t < 2.2; t += 0.025) {
      clock.currentTime = t;
      metronome.tick();
    }
    expect(clicks.slice(0, 8).map((c) => c.accent)).toEqual([
      true, false, false, false, true, false, false, false,
    ]);
    metronome.stop();
  });

  it('accents beats 1 and 4 in 6/8', () => {
    const { clock, clicks } = fakeClock();
    const metronome = new MetronomeScheduler(clock, { bpm: 240, timeSignature: sixEight });
    metronome.start();
    for (let t = 0; t < 2; t += 0.025) {
      clock.currentTime = t;
      metronome.tick();
    }
    expect(clicks.slice(0, 6).map((c) => c.accent)).toEqual([true, false, false, true, false, false]);
    metronome.stop();
  });

  it('only books clicks inside the lookahead window', () => {
    const { clock, clicks } = fakeClock();
    const metronome = new MetronomeScheduler(clock, { bpm: 60, timeSignature: fourFour });
    metronome.start();
    expect(clicks).toHaveLength(1); // the first beat; the next is a second away
    metronome.stop();
  });

  it('reports each booked beat', () => {
    const { clock } = fakeClock();
    const onBeat = vi.fn();
    const metronome = new MetronomeScheduler(clock, { bpm: 120, timeSignature: fourFour, onBeat });
    metronome.start();
    expect(onBeat).toHaveBeenCalledWith(0, expect.any(Number));
    metronome.stop();
  });

  it('stops booking clicks when stopped', () => {
    const { clock, clicks } = fakeClock();
    const metronome = new MetronomeScheduler(clock, { bpm: 120, timeSignature: fourFour });
    metronome.start();
    metronome.stop();
    const count = clicks.length;
    clock.currentTime = 5;
    vi.advanceTimersByTime(1000);
    expect(clicks).toHaveLength(count);
    expect(metronome.running).toBe(false);
  });

  it('applies a new tempo to the following clicks', () => {
    const { clock, clicks } = fakeClock();
    const metronome = new MetronomeScheduler(clock, { bpm: 60, timeSignature: fourFour });
    metronome.start();
    metronome.setTempo(120);
    for (let t = 0; t < 3; t += 0.025) {
      clock.currentTime = t;
      metronome.tick();
    }
    expect(clicks[2].time - clicks[1].time).toBeCloseTo(0.5);
    metronome.stop();
  });
});

describe('tempo helpers', () => {
  it('names tempos with Italian markings', () => {
    expect(tempoMarking(50)).toBe('Largo');
    expect(tempoMarking(96)).toBe('Andante');
    expect(tempoMarking(130)).toBe('Allegro');
    expect(tempoMarking(220)).toBe('Prestissimo');
  });

  it('clamps and rounds BPM', () => {
    expect(clampBpm(10)).toBe(30);
    expect(clampBpm(999)).toBe(240);
    expect(clampBpm(96.6)).toBe(97);
  });

  it('calculates tempo from taps', () => {
    expect(tempoFromTaps([0, 500, 1000, 1500])).toBe(120);
    expect(tempoFromTaps([0, 600])).toBe(100);
  });

  it('needs at least two taps', () => {
    expect(tempoFromTaps([])).toBeNull();
    expect(tempoFromTaps([1000])).toBeNull();
  });

  it('ignores taps from an earlier burst', () => {
    expect(tempoFromTaps([0, 400, 10000, 10500, 11000])).toBe(120);
  });
});
