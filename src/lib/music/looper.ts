/**
 * @fileoverview Looper: plays a melody over and over until stopped.
 *
 * Like a loop pedal or the song-playback button on a digital piano. It
 * doesn't make sound itself: it presses and releases notes on a *target*
 * (the piano), so the keys light up and every setting applies.
 *
 * ## Timing without drift
 * Every note is booked with `setTimeout` at an **absolute** time on one
 * fixed timeline (`passStart + note.start × msPerBeat`), never "x ms after
 * the previous note". A late timer then delays only its own note; it can't
 * push the following notes back, so the loop stays in time however long it
 * runs. See ADR 0012.
 *
 * ```
 *  pass 1                       pass 2
 *  |♪  ♪ ♪   ♪  ♪       |       |♪  ♪ ♪ …
 *                    ▲ booked 100 ms ahead, from passStart + loop length
 * ```
 */

import { LOOP_GATE, LOOP_MAX_LATE_MS, LOOP_SCHEDULE_AHEAD_MS } from '../constants';
import { midiToNoteId } from './notes';
import { Sequence } from './sequence';

/** What the looper plays on */
export interface LoopTarget {
  noteOn(noteId: string): void;
  noteOff(noteId: string): void;
}

export class Looper {
  private timers = new Set<ReturnType<typeof setTimeout>>();
  /** Notes the looper is holding down → which press holds them */
  private held = new Map<string, number>();
  private presses = 0;
  private sequence: Sequence | null = null;
  private msPerBeat = 0;

  /**
   * @param target    - Receives the note presses and releases
   * @param noteIdFor - Turns a melody note into the key to press (e.g. to follow an octave shift)
   */
  constructor(
    private target: LoopTarget,
    private noteIdFor: (midi: number) => string = midiToNoteId
  ) {}

  get playing(): boolean {
    return this.sequence !== null;
  }

  /** Start looping a melody at a tempo, replacing whatever was playing */
  play(sequence: Sequence, bpm: number): void {
    this.stop();
    this.sequence = sequence;
    this.msPerBeat = 60000 / bpm;
    this.bookPass(Date.now());
  }

  /** Cancel every booked note and release the ones still held */
  stop(): void {
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    this.held.forEach((_, noteId) => this.target.noteOff(noteId));
    this.held.clear();
    this.sequence = null;
  }

  /** Book one pass of the melody, and the booking of the pass after it */
  private bookPass(passStart: number): void {
    const sequence = this.sequence;
    if (!sequence) return;

    // Timers fell far behind (background tab): start over from now
    // rather than firing every missed note at once
    const now = Date.now();
    const start = passStart < now - LOOP_MAX_LATE_MS ? now : passStart;

    for (const note of sequence.notes) {
      const gate = note.length * this.msPerBeat * LOOP_GATE;
      this.at(start + note.start * this.msPerBeat, () => this.press(note.midi, gate));
    }

    const nextPass = start + sequence.beats * this.msPerBeat;
    this.at(nextPass - LOOP_SCHEDULE_AHEAD_MS, () => this.bookPass(nextPass));
  }

  /** Press a key now and release it after `gate` ms */
  private press(midi: number, gate: number): void {
    const noteId = this.noteIdFor(midi);
    // Still held from an earlier press: lift it so the key strikes again
    // (the piano ignores a press on a key that's already down)
    if (this.held.has(noteId)) this.target.noteOff(noteId);

    const press = ++this.presses;
    this.held.set(noteId, press);
    this.target.noteOn(noteId);

    this.at(Date.now() + gate, () => {
      if (this.held.get(noteId) !== press) return; // a newer press owns the key now
      this.held.delete(noteId);
      this.target.noteOff(noteId);
    });
  }

  /** Run `callback` at an absolute time (`Date.now()` ms) */
  private at(time: number, callback: () => void): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, Math.max(0, time - Date.now()));
    this.timers.add(timer);
  }
}
