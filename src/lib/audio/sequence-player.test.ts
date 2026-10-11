import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SequencePlayer, PlaybackOutput, SequencePlayerOptions } from './sequence-player';
import { PianoNoteEvent } from '@/types';
import { SEQUENCE_LOOKAHEAD_MS, SEQUENCE_SCHEDULE_AHEAD, SEQUENCE_START_DELAY } from '../constants';

const D = SEQUENCE_START_DELAY;

const note = (id: string, midi: number, startTime: number, endTime: number): PianoNoteEvent => ({
  id,
  midi,
  startTime,
  endTime,
  velocity: 0.8,
});

/**
 * A test bench: a clock we move by hand, timers we fast-forward together
 * with it, and an output that records every booking and cancellation.
 */
function setup(notes: PianoNoteEvent[], duration: number, options: SequencePlayerOptions = {}) {
  const clock = { currentTime: 100 }; // the audio clock rarely starts at 0
  const booked: Array<{ id: string; start: number; end: number; cancelled: boolean }> = [];
  const output: PlaybackOutput = {
    scheduleNote: (n, start, end) => {
      const entry = { id: n.id, start, end, cancelled: false };
      booked.push(entry);
      return { cancel: () => (entry.cancelled = true) };
    },
  };
  const player = new SequencePlayer(clock, output, options);
  player.load(notes, duration);

  /** Move both clocks forward together, as in a real browser */
  const advance = (seconds: number) => {
    const steps = Math.round((seconds * 1000) / SEQUENCE_LOOKAHEAD_MS);
    for (let i = 0; i < steps; i++) {
      clock.currentTime += SEQUENCE_LOOKAHEAD_MS / 1000;
      vi.advanceTimersByTime(SEQUENCE_LOOKAHEAD_MS);
    }
  };
  const live = () => booked.filter((b) => !b.cancelled);
  return { clock, booked, live, player, advance };
}

describe('SequencePlayer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const melody = [note('a', 60, 0, 0.5), note('b', 64, 0.5, 1), note('c', 67, 1, 2)];

  describe('timing', () => {
    it('books each note at its exact audio-clock time, from just after Play', () => {
      const { player, booked, advance } = setup(melody, 2);
      player.play();
      advance(1.5);

      expect(booked.map((b) => [b.id, b.start, b.end])).toEqual([
        ['a', 100 + D, 100 + D + 0.5],
        ['b', 100 + D + 0.5, 100 + D + 1],
        ['c', 100 + D + 1, 100 + D + 2],
      ]);
    });

    it('books only a short way ahead, so nothing is booked long before it plays', () => {
      const { player, booked, advance } = setup([note('a', 60, 0, 1), note('late', 62, 30, 31)], 31);
      player.play();
      advance(1);
      expect(booked.map((b) => b.id)).toEqual(['a']);

      advance(30 - 1 - SEQUENCE_SCHEDULE_AHEAD + 0.1);
      expect(booked.map((b) => b.id)).toEqual(['a', 'late']);
    });

    it('books the notes of a chord together', () => {
      const chord = [note('c', 60, 1, 2), note('e', 64, 1, 2), note('g', 67, 1, 2)];
      const { player, booked, advance } = setup(chord, 2);
      player.play();
      advance(1);
      expect(booked.map((b) => b.start)).toEqual([101 + D, 101 + D, 101 + D]);
    });

    it('keeps overlapping notes of different lengths', () => {
      const { player, booked, advance } = setup([note('long', 48, 0, 4), note('short', 72, 0.5, 0.75)], 4);
      player.play();
      advance(1);
      expect(booked.map((b) => b.end - b.start)).toEqual([4, 0.25].map((x) => expect.closeTo(x, 9)));
    });

    it('keeps long silences: a note a minute in plays a minute in', () => {
      const { player, booked, advance } = setup([note('a', 60, 0, 1), note('b', 62, 60, 61)], 61);
      player.play();
      advance(60);
      expect(booked[1].start - booked[0].start).toBeCloseTo(60, 9);
    });

    it('plays a five-minute transcription across its whole timeline', () => {
      const notes = Array.from({ length: 300 }, (_, i) => note(`n${i}`, 60 + (i % 12), i, i + 0.8));
      const onEnded = vi.fn();
      const { player, booked, advance } = setup(notes, 300, { onEnded });
      player.play();
      advance(299);
      expect(booked).toHaveLength(300);
      expect(booked.at(-1)!.start - booked[0].start).toBeCloseTo(299, 6);
      expect(onEnded).not.toHaveBeenCalled();

      advance(1.5);
      expect(onEnded).toHaveBeenCalledTimes(1);
      expect(player.state).toBe('stopped');
    });

    it('runs to the end of the recording, not the last note', () => {
      const onEnded = vi.fn();
      const { player, advance } = setup([note('a', 60, 0, 1)], 10, { onEnded });
      player.play();
      advance(5);
      expect(player.state).toBe('playing');
      expect(player.position).toBeCloseTo(5 - D, 1);
      advance(5.2);
      expect(onEnded).toHaveBeenCalled();
      expect(player.position).toBe(0);
    });

    it('lasts at least until the last note ends, whatever duration it is given', () => {
      const { player } = setup([note('a', 60, 0, 12)], 10);
      expect(player.duration).toBe(12);
    });
  });

  describe('transport', () => {
    it('pauses: cancels the notes still sounding or booked, and remembers the position', () => {
      const { player, booked, advance } = setup(melody, 2);
      player.play();
      advance(0.7); // b is sounding
      player.pause();

      expect(player.state).toBe('paused');
      expect(player.position).toBeCloseTo(0.7 - D, 1);
      expect(booked.find((b) => b.id === 'b')!.cancelled).toBe(true);
      expect(booked.find((b) => b.id === 'a')!.cancelled).toBe(false); // already finished
    });

    it('resumes from where it paused, without replaying earlier notes', () => {
      const { player, booked, advance } = setup(melody, 2);
      player.play();
      advance(0.7);
      player.pause();
      advance(5); // time passes while paused
      const before = booked.length;
      player.play();
      advance(1);

      const resumed = booked.slice(before);
      expect(resumed.map((b) => b.id)).toEqual(['c']); // b had started: not struck again
      expect(resumed[0].start).toBeCloseTo(105.7 + D + (1 - (0.7 - D)), 1);
    });

    it('stops and returns to the start', () => {
      const { player, live, advance } = setup(melody, 2);
      player.play();
      advance(0.7);
      player.stop();
      expect(player.state).toBe('stopped');
      expect(player.position).toBe(0);
      expect(live().filter((b) => b.end > 100.7)).toHaveLength(0);
    });

    it('seeks while playing: cancels what was booked and plays on from the new position', () => {
      const { player, booked, advance } = setup(melody, 2);
      player.play();
      advance(0.1);
      player.seek(1);
      advance(0.5);

      const afterSeek = booked.filter((b) => !b.cancelled && b.id !== 'a');
      expect(afterSeek.map((b) => b.id)).toEqual(['c']);
      expect(booked.find((b) => b.id === 'a')!.cancelled).toBe(true);
    });

    it('seeks while paused or stopped, and plays from there', () => {
      const { player, booked, advance } = setup(melody, 2);
      player.seek(0.5);
      expect(player.position).toBe(0.5);
      player.play();
      advance(0.2);
      expect(booked[0].id).toBe('b'); // a note starting exactly at the position plays
    });

    it('clamps seeks to the piece', () => {
      const { player } = setup(melody, 2);
      player.seek(-4);
      expect(player.position).toBe(0);
      player.seek(99);
      expect(player.position).toBe(2);
      player.seek(NaN);
      expect(player.position).toBe(0);
    });

    it('starts over when Play is pressed at the end', () => {
      const { player, booked, advance } = setup(melody, 2);
      player.seek(2);
      player.play();
      advance(0.1);
      expect(booked[0].id).toBe('a');
    });

    it('does not double-book when Play is pressed twice or stop/start is rapid', () => {
      const { player, live, advance } = setup(melody, 2);
      player.play();
      player.play();
      player.stop();
      player.play();
      player.stop();
      player.play();
      advance(0.2);
      expect(live().map((b) => b.id)).toEqual(['a']);
    });

    it('reports state changes', () => {
      const onStateChange = vi.fn();
      const { player } = setup(melody, 2, { onStateChange });
      player.play();
      player.pause();
      player.stop();
      expect(onStateChange.mock.calls.map(([s]) => s)).toEqual(['playing', 'paused', 'stopped']);
    });

    it('cancels everything when disposed', () => {
      const { player, live, advance } = setup(melody, 2);
      player.play();
      advance(0.2);
      player.dispose();
      advance(3);
      expect(live().every((b) => b.end <= 100.2)).toBe(true);
    });
  });

  describe('speed', () => {
    it('plays faster at a higher rate', () => {
      const { player, booked, advance } = setup(melody, 2);
      player.setRate(2);
      player.play();
      advance(1);
      expect(booked.map((b) => b.start - booked[0].start)).toEqual([0, 0.25, 0.5]);
      expect(booked[2].end - booked[2].start).toBeCloseTo(0.5);
    });

    it('changes speed mid-play without jumping, re-booking notes not yet started', () => {
      const notes = [note('a', 60, 0, 0.1), note('b', 62, 0.15, 0.3), note('c', 64, 1, 2)];
      const { player, booked, live, advance } = setup(notes, 2);
      player.play();
      advance(0.1); // a and b booked; b not started yet
      const before = player.position;
      player.setRate(0.5);
      expect(player.position).toBeCloseTo(before, 6);
      expect(booked.find((b) => b.id === 'b')!.cancelled).toBe(true);

      advance(2);
      const c = live().find((b) => b.id === 'c')!;
      // c is 1 − 0.05 s of song time after the change point: twice that in audio time
      expect(c.start).toBeCloseTo(100.1 + (1 - before) / 0.5, 6);
      expect(live().filter((b) => b.id === 'b')).toHaveLength(1);
    });

    // Regression: changing speed during the start delay used to skip the first notes
    it('keeps the first notes when the speed changes the instant playback starts', () => {
      const { player, live, advance } = setup(melody, 2);
      player.play();
      player.setRate(1.25);
      advance(0.1);
      expect(live().map((b) => b.id)).toContain('a');
    });

    it('clamps the rate', () => {
      const { player } = setup(melody, 2);
      player.setRate(10);
      expect(player.rate).toBe(2);
      player.setRate(0);
      expect(player.rate).toBe(0.25);
    });
  });

  describe('loop', () => {
    it('starts again from the top at the end, on time', () => {
      const { player, booked, advance } = setup(melody, 2);
      player.setLoop(true);
      player.play();
      advance(4.2); // books up to song time ≈ 4.35: the third pass has just begun

      expect(booked.map((b) => b.id)).toEqual(['a', 'b', 'c', 'a', 'b', 'c', 'a']);
      expect(booked[3].start - booked[0].start).toBeCloseTo(2, 9);
      expect(player.state).toBe('playing');
      expect(player.position).toBeCloseTo((4.2 - D) % 2, 1);
    });

    it('stops at the end of the current pass when the loop is switched off', () => {
      const onEnded = vi.fn();
      const { player, advance } = setup(melody, 2, { onEnded });
      player.setLoop(true);
      player.play();
      advance(2.5); // second pass
      player.setLoop(false);
      advance(1);
      expect(player.state).toBe('playing');
      advance(1);
      expect(onEnded).toHaveBeenCalled();
    });

    it('loops an empty piece without spinning', () => {
      const { player, advance } = setup([], 1);
      player.setLoop(true);
      player.play();
      advance(3);
      expect(player.state).toBe('playing');
    });
  });

  describe('editing and lighting', () => {
    it('takes edited notes while playing and carries on from the same place', () => {
      const { player, live, advance } = setup(melody, 2);
      player.play();
      advance(0.6);
      player.load([...melody, note('d', 72, 1.2, 1.5)], 2);
      advance(1);
      expect(live().map((b) => b.id)).toEqual(expect.arrayContaining(['c', 'd']));
      expect(live().filter((b) => b.id === 'a')).toHaveLength(1);
    });

    it('lists the notes sounding right now', () => {
      const { player, advance } = setup([note('low', 48, 0, 2), ...melody], 2);
      player.play();
      advance(0.6);
      expect(
        player
          .soundingNotes()
          .map((b) => b.note.id)
          .sort()
      ).toEqual(['b', 'low']);
    });

    it('books further ahead when told to (a hidden tab)', () => {
      const { player, booked } = setup([note('a', 60, 0, 1), note('b', 62, 1, 2)], 2, { scheduleAhead: () => 1.5 });
      player.play();
      expect(booked.map((b) => b.id)).toEqual(['a', 'b']);
    });
  });
});
