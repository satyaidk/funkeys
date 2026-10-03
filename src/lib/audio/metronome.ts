/**
 * @fileoverview Metronome: sample-accurate click scheduling and tempo helpers.
 *
 * ## Why not just `setInterval(click, 60000 / bpm)`?
 * JavaScript timers drift and stall: a busy main thread (React rendering,
 * garbage collection) can delay them by tens of milliseconds, which you can
 * hear. The audio clock, on the other hand, is sample-accurate.
 *
 * So this uses the classic **lookahead scheduler** ("A Tale of Two Clocks",
 * Chris Wilson): a timer wakes up every 25 ms, and books any clicks due in
 * the next ~120 ms at their *exact* audio-clock time. The timer can be late;
 * the clicks never are.
 *
 * ```
 * timer ticks:   |    |    |    |    |    |      (every 25 ms, jittery)
 * lookahead:     [=====120 ms=====]
 * clicks:        ♪              ♪              ♪  (exact, on the audio clock)
 * ```
 */

import {
  MAX_BPM,
  METRONOME_LOOKAHEAD_MS,
  METRONOME_SCHEDULE_AHEAD,
  MIN_BPM,
  TAP_TEMPO_RESET_MS,
} from '../constants';

export interface TimeSignature {
  id: string;
  /** Clicks per bar */
  beats: number;
  /** Beat indexes that get an accented click */
  accents: readonly number[];
}

export const TIME_SIGNATURES: readonly TimeSignature[] = [
  { id: '2/4', beats: 2, accents: [0] },
  { id: '3/4', beats: 3, accents: [0] },
  { id: '4/4', beats: 4, accents: [0] },
  { id: '6/8', beats: 6, accents: [0, 3] },
];

/** Italian tempo markings, as printed in sheet music (upper BPM bound, name) */
const TEMPO_MARKINGS: ReadonlyArray<[number, string]> = [
  [40, 'Grave'],
  [60, 'Largo'],
  [66, 'Larghetto'],
  [76, 'Adagio'],
  [108, 'Andante'],
  [120, 'Moderato'],
  [156, 'Allegro'],
  [176, 'Vivace'],
  [200, 'Presto'],
  [Infinity, 'Prestissimo'],
];

/** The tempo marking for a BPM, e.g. 96 → 'Andante' */
export function tempoMarking(bpm: number): string {
  return TEMPO_MARKINGS.find(([max]) => bpm < max)![1];
}

export function clampBpm(bpm: number): number {
  return Math.round(Math.min(MAX_BPM, Math.max(MIN_BPM, bpm)));
}

/**
 * Tempo from a series of taps (timestamps in ms).
 *
 * Uses the average of the last (up to 4) intervals, ignoring taps from a
 * previous burst (more than TAP_TEMPO_RESET_MS apart). Returns `null` until
 * there are at least two taps.
 */
export function tempoFromTaps(taps: readonly number[]): number | null {
  // Keep only the latest burst of taps
  let start = taps.length - 1;
  while (start > 0 && taps[start] - taps[start - 1] <= TAP_TEMPO_RESET_MS) start--;
  const burst = taps.slice(start).slice(-5);
  if (burst.length < 2) return null;

  const intervals = burst.slice(1).map((t, i) => t - burst[i]);
  const average = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
  return clampBpm(60000 / average);
}

/** What the scheduler needs from the audio engine */
export interface MetronomeClock {
  readonly currentTime: number;
  scheduleClick(time: number, accent: boolean): void;
}

export interface MetronomeOptions {
  bpm: number;
  timeSignature: TimeSignature;
  /** Called when a click is booked, with its beat index and audio-clock time */
  onBeat?: (beat: number, time: number) => void;
}

export class MetronomeScheduler {
  private bpm: number;
  private timeSignature: TimeSignature;
  private onBeat?: (beat: number, time: number) => void;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBeatTime = 0;
  private beat = 0;

  constructor(private clock: MetronomeClock, options: MetronomeOptions) {
    this.bpm = clampBpm(options.bpm);
    this.timeSignature = options.timeSignature;
    this.onBeat = options.onBeat;
  }

  get running(): boolean {
    return this.timer !== null;
  }

  start(): void {
    if (this.running) return;
    this.beat = 0;
    this.nextBeatTime = this.clock.currentTime + 0.05; // small gap so the first click isn't late
    this.timer = setInterval(() => this.tick(), METRONOME_LOOKAHEAD_MS);
    this.tick();
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  /** Change tempo; takes effect from the next unscheduled click */
  setTempo(bpm: number): void {
    this.bpm = clampBpm(bpm);
  }

  /** Change time signature; restarts counting from beat 1 on the next click */
  setTimeSignature(timeSignature: TimeSignature): void {
    this.timeSignature = timeSignature;
    this.beat = 0;
  }

  /** Book every click that falls inside the lookahead window */
  tick(): void {
    const horizon = this.clock.currentTime + METRONOME_SCHEDULE_AHEAD;
    while (this.nextBeatTime < horizon) {
      const accent = this.timeSignature.accents.includes(this.beat);
      this.clock.scheduleClick(this.nextBeatTime, accent);
      this.onBeat?.(this.beat, this.nextBeatTime);
      this.beat = (this.beat + 1) % this.timeSignature.beats;
      this.nextBeatTime += 60 / this.bpm;
    }
  }
}
