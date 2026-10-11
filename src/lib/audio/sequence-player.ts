/**
 * @fileoverview SequencePlayer: plays timed notes on the audio clock.
 *
 * One transport for everything with a timeline: songs from the Notes
 * library and audio transcriptions. Play, pause, resume, stop, seek, speed
 * and loop, with the notes booked at exact audio-clock times.
 *
 * ## Two clocks (the metronome's technique, ADR 0007 and 0013)
 * A timer wakes every 25 ms and books every note due in the next ~200 ms
 * at its *exact* audio-clock time. The timer can be late; the notes never
 * are, and nothing drifts over a five-minute piece.
 *
 * ```
 *  timer ticks:   |    |    |    |    |    |        (every 25 ms, jittery)
 *  booking window:[=====200 ms=====]
 *  notes:          ♪   ♪♪      ♪   ♪               (exact, on the audio clock)
 * ```
 *
 * ## Song time and audio time
 * While playing, one anchor links the two: song time `anchorSong` sounded at
 * audio time `anchorAudio`, and song time runs `rate` times as fast:
 *
 * ```
 *   songTime(t)  = anchorSong + (t − anchorAudio) × rate
 *   audioTime(s) = anchorAudio + (s − anchorSong) / rate
 * ```
 *
 * Seeking, resuming or changing speed just moves the anchor. When looping,
 * song time keeps counting past the end (pass 2 starts at `duration`), and
 * the position shown is that time modulo the duration.
 *
 * Silence is part of the piece: a recording that ends with ten quiet
 * seconds plays for those ten seconds too, because the player runs to
 * `duration`, not to the last note.
 *
 * Like the metronome scheduler it's a plain class: it never touches React
 * or Web Audio directly, so it is tested with a fake clock.
 */

import { PianoNoteEvent } from '@/types';
import {
  MAX_PLAYBACK_RATE,
  MIN_PLAYBACK_RATE,
  SEQUENCE_LOOKAHEAD_MS,
  SEQUENCE_SCHEDULE_AHEAD,
  SEQUENCE_START_DELAY,
} from '../constants';
import { notesEndTime, sortNotes } from '../music/note-events';

export type PlaybackState = 'stopped' | 'playing' | 'paused';

/** The audio clock (seconds) */
export interface PlaybackClock {
  readonly currentTime: number;
}

/** A note handed to the output, which can be cancelled */
export interface BookedNote {
  cancel(): void;
}

/** Where notes go: the audio engine, through `useSequencePlayer` */
export interface PlaybackOutput {
  /** Sound a note from `start` to `end` (audio-clock seconds) */
  scheduleNote(note: PianoNoteEvent, start: number, end: number): BookedNote | null;
}

export interface SequencePlayerOptions {
  /** Called on every change of state */
  onStateChange?: (state: PlaybackState) => void;
  /** Called when playback reaches the end by itself (not when stopped) */
  onEnded?: () => void;
  /** How far ahead (s) to book; asked on every tick so it can change (hidden tab) */
  scheduleAhead?: () => number;
}

/** A note handed to the output, with its audio-clock times */
export interface Booking {
  note: PianoNoteEvent;
  start: number;
  end: number;
  handle: BookedNote | null;
  /** Where it came from: its index in the notes and its pass of the loop */
  index: number;
  pass: number;
}

/** Index of the first note starting at or after `time` (binary search: notes are sorted) */
function firstNoteFrom(notes: readonly PianoNoteEvent[], time: number): number {
  let low = 0;
  let high = notes.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (notes[mid].startTime < time) low = mid + 1;
    else high = mid;
  }
  return low;
}

export class SequencePlayer {
  private notes: PianoNoteEvent[] = [];
  private _duration = 0;
  private _state: PlaybackState = 'stopped';
  private _rate = 1;
  private _loop = false;

  /** Position while paused or stopped */
  private idlePosition = 0;
  // While playing: song time `anchorSong` (counting on past the end when looping) sounds at `anchorAudio`
  private anchorAudio = 0;
  private anchorSong = 0;
  /** The next note to book: its index and which pass of the loop */
  private nextIndex = 0;
  private nextPass = 0;

  private booked: Booking[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private clock: PlaybackClock,
    private output: PlaybackOutput,
    private options: SequencePlayerOptions = {}
  ) {}

  // ── State ──────────────────────────────────────────────────────────────

  get state(): PlaybackState {
    return this._state;
  }

  /** Length in seconds: the given duration, or the last note's end if later */
  get duration(): number {
    return this._duration;
  }

  get rate(): number {
    return this._rate;
  }

  get loop(): boolean {
    return this._loop;
  }

  get noteCount(): number {
    return this.notes.length;
  }

  /** Current position in seconds, 0 … duration */
  get position(): number {
    if (this._state !== 'playing') return this.idlePosition;
    return this.wrap(this.songTimeAt(this.clock.currentTime));
  }

  /** Bookings sounding right now, for lighting keys */
  soundingNotes(): Booking[] {
    const now = this.clock.currentTime;
    return this.booked.filter((b) => b.start <= now && now < b.end);
  }

  // ── Transport ──────────────────────────────────────────────────────────

  /**
   * Replace the notes. If playing, playback carries on from the same
   * position with the new notes (e.g. after an edit).
   *
   * @param duration - Length of the piece; silence after the last note counts
   */
  load(notes: readonly PianoNoteEvent[], duration: number): void {
    const playing = this._state === 'playing';
    const position = this.position;
    this.notes = sortNotes(notes);
    this._duration = Math.max(0, duration, notesEndTime(this.notes));
    if (playing) {
      this.cancelBooked();
      this.startFrom(Math.min(position, this._duration));
      this.tick();
    } else {
      this.idlePosition = Math.min(this.idlePosition, this._duration);
    }
  }

  /** Play from the current position (from the start if it's at the end) */
  play(): void {
    if (this._state === 'playing') return;
    const from = this.idlePosition >= this._duration ? 0 : this.idlePosition;
    this.startFrom(from);
    this.timer = setInterval(() => this.tick(), SEQUENCE_LOOKAHEAD_MS);
    this.setState('playing');
    this.tick();
  }

  /** Stop where we are; `play()` resumes from here */
  pause(): void {
    if (this._state !== 'playing') return;
    this.idlePosition = this.position;
    this.halt();
    this.setState('paused');
  }

  /** Stop and go back to the start */
  stop(): void {
    this.halt();
    this.idlePosition = 0;
    if (this._state !== 'stopped') this.setState('stopped');
  }

  /** Jump to a position in seconds (clamped to the piece) */
  seek(position: number): void {
    const target = Math.min(this._duration, Math.max(0, Number.isFinite(position) ? position : 0));
    if (this._state !== 'playing') {
      this.idlePosition = target;
      return;
    }
    this.cancelBooked();
    this.startFrom(target);
    this.tick();
  }

  /** Playback speed: 1 is the original tempo (clamped to 0.25–2) */
  setRate(rate: number): void {
    const next = Math.min(MAX_PLAYBACK_RATE, Math.max(MIN_PLAYBACK_RATE, rate));
    if (next === this._rate) return;
    if (this._state !== 'playing') {
      this._rate = next;
      return;
    }
    this.reanchor(() => {
      this._rate = next;
    });
  }

  /** Repeat from the start at the end */
  setLoop(loop: boolean): void {
    if (loop === this._loop) return;
    if (this._state !== 'playing') {
      this._loop = loop;
      return;
    }
    this.reanchor(() => {
      this._loop = loop;
    });
  }

  /** Stop and release everything (unmount) */
  dispose(): void {
    this.halt();
  }

  // ── Scheduling ─────────────────────────────────────────────────────────

  /** Book every note due before the horizon. Runs on the timer; public for tests. */
  tick(): void {
    if (this._state !== 'playing') return;
    const now = this.clock.currentTime;

    // Forget notes that have finished
    this.booked = this.booked.filter((b) => b.end > now);

    if (!this._loop && this.songTimeAt(now) >= this._duration) {
      this.finish();
      return;
    }

    const ahead = this.options.scheduleAhead?.() ?? SEQUENCE_SCHEDULE_AHEAD;
    const horizon = this.songTimeAt(now + ahead);
    const canLoop = this._loop && this.notes.length > 0 && this._duration > 0;

    for (;;) {
      if (this.nextIndex >= this.notes.length) {
        if (!canLoop) break;
        this.nextIndex = 0;
        this.nextPass++;
      }
      const note = this.notes[this.nextIndex];
      const at = this.nextPass * this._duration + note.startTime;
      if (at >= horizon) break;
      this.book(this.nextIndex, this.nextPass, at);
      this.nextIndex++;
    }
  }

  private book(index: number, pass: number, at: number): void {
    const note = this.notes[index];
    const start = this.audioTimeAt(at);
    const end = this.audioTimeAt(at + (note.endTime - note.startTime));
    const handle = this.output.scheduleNote(note, start, end);
    this.booked.push({ note, start, end, handle, index, pass });
  }

  /** Anchor song time `position` just after now, and book from the first note at or after it */
  private startFrom(position: number): void {
    this.anchorAudio = this.clock.currentTime + SEQUENCE_START_DELAY;
    this.anchorSong = position;
    this.nextPass = 0;
    this.nextIndex = firstNoteFrom(this.notes, position);
  }

  /**
   * Change the rules while playing (speed, loop). Notes
   * already sounding carry on; notes booked for later are cancelled and
   * booked again under the new rules, from the earliest one cancelled.
   */
  private reanchor(change: () => void): void {
    const now = this.clock.currentTime;
    // Same line through "now", so the position doesn't jump
    this.anchorSong = this.songTimeAt(now);
    this.anchorAudio = now;

    let resume: Booking | null = null;
    this.booked = this.booked.filter((b) => {
      if (b.start <= now) return true;
      b.handle?.cancel();
      if (!resume || b.pass < resume.pass || (b.pass === resume.pass && b.index < resume.index)) resume = b;
      return false;
    });
    if (resume) {
      this.nextPass = (resume as Booking).pass;
      this.nextIndex = (resume as Booking).index;
    }

    change();

    // Loop switched off during a later pass: count from this pass as if it were the first
    if (!this._loop && this._duration > 0 && this.anchorSong >= this._duration) {
      const passes = Math.floor(this.anchorSong / this._duration);
      this.anchorSong -= passes * this._duration;
      this.nextPass -= passes;
      this.booked.forEach((b) => (b.pass -= passes));
    }
    this.tick();
  }

  private finish(): void {
    this.halt();
    this.idlePosition = 0;
    this.setState('stopped');
    this.options.onEnded?.();
  }

  private halt(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.cancelBooked();
  }

  private cancelBooked(): void {
    this.booked.forEach((b) => b.handle?.cancel());
    this.booked = [];
  }

  private setState(state: PlaybackState): void {
    this._state = state;
    this.options.onStateChange?.(state);
  }

  private songTimeAt(audioTime: number): number {
    return this.anchorSong + (audioTime - this.anchorAudio) * this._rate;
  }

  private audioTimeAt(songTime: number): number {
    return this.anchorAudio + (songTime - this.anchorSong) / this._rate;
  }

  /** Song time → position in the piece (modulo the length when looping) */
  private wrap(songTime: number): number {
    const t = Math.max(0, songTime);
    if (this._loop && this._duration > 0) return t % this._duration;
    return Math.min(t, this._duration);
  }
}
