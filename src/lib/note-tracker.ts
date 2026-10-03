/**
 * @fileoverview Which notes are held, which keep ringing, and why.
 *
 * A pure state machine for keys and the two pedals that keep notes
 * sounding after their keys come up:
 *
 * - **Sustain (damper) pedal**: lifts every damper. Released keys keep
 *   ringing until the pedal comes up.
 * - **Sostenuto pedal**: holds only the notes whose dampers were up *at the
 *   moment it was pressed* (keys held then, plus anything the sustain pedal
 *   was holding). Notes played afterwards behave normally.
 *
 * The tracker never touches audio. Each method returns what the caller
 * should do ("stop these notes"), which keeps it trivial to unit-test.
 * (The soft pedal changes tone, not duration, so it isn't tracked here.)
 */

export type ReleaseOutcome = 'stop' | 'sustain' | 'ignore';

export class NoteTracker {
  private held = new Set<string>();
  /** Keys released while a pedal keeps them ringing */
  private ringing = new Set<string>();
  /** Notes caught by the sostenuto pedal when it went down */
  private captured = new Set<string>();
  private sustainDown = false;
  private sostenutoDown = false;

  /** Notes whose key is down */
  get heldIds(): ReadonlySet<string> {
    return this.held;
  }

  /** Notes whose key is up but still sound because of a pedal */
  get ringingIds(): ReadonlySet<string> {
    return this.ringing;
  }

  /**
   * A key went down.
   * @returns false if the note was already held (e.g. clicked *and* typed)
   */
  press(noteId: string): boolean {
    if (this.held.has(noteId)) return false;
    this.held.add(noteId);
    this.ringing.delete(noteId);
    return true;
  }

  /** A key came up: should the note stop, keep ringing, or was it not held? */
  release(noteId: string): ReleaseOutcome {
    if (!this.held.delete(noteId)) return 'ignore';
    if (this.isPedalHolding(noteId)) {
      this.ringing.add(noteId);
      return 'sustain';
    }
    return 'stop';
  }

  /**
   * Sustain pedal moved.
   * @returns notes to stop (pedal up releases everything it was holding)
   */
  setSustain(down: boolean): string[] {
    this.sustainDown = down;
    return down ? [] : this.releaseUnheld();
  }

  /**
   * Sostenuto pedal moved.
   * @returns notes to stop
   */
  setSostenuto(down: boolean): string[] {
    if (down && !this.sostenutoDown) {
      // Catch every note whose damper is up right now
      this.captured = new Set([...this.held, ...(this.sustainDown ? this.ringing : [])]);
    }
    this.sostenutoDown = down;
    if (down) return [];
    const stopped = this.releaseUnheld();
    this.captured.clear();
    return stopped;
  }

  /** Forget every note (octave change, panic). Pedal positions are kept. */
  clearNotes(): void {
    this.held.clear();
    this.ringing.clear();
    this.captured.clear();
  }

  private isPedalHolding(noteId: string): boolean {
    return this.sustainDown || (this.sostenutoDown && this.captured.has(noteId));
  }

  /** Stop ringing notes that no pedal holds any more */
  private releaseUnheld(): string[] {
    const toStop = [...this.ringing].filter((id) => !this.isPedalHolding(id));
    toStop.forEach((id) => this.ringing.delete(id));
    return toStop;
  }
}
