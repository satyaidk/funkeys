import { describe, it, expect } from 'vitest';
import { SONGS, getSong } from './song-library';
import {
  beatsPerBar,
  CATEGORIES,
  curatedPicks,
  CURATED_PICKS,
  filterSongs,
  Song,
  songTimeline,
} from './songs';
import { parseSequence } from './sequence';
import { PIANO_HIGHEST_MIDI, PIANO_LOWEST_MIDI, SONG_GATE } from '../constants';

describe('song library', () => {
  it('has unique ids', () => {
    const ids = SONGS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // One test per song, so a typo names the song it's in
  it.each(SONGS.map((s) => [s.title, s] as const))(
    '%s parses, stays on the piano and fills whole bars in every part',
    (_, song) => {
      const parts = song.parts.map((part) => parseSequence(part));
      const bar = beatsPerBar(song.timeSignature);

      expect(song.bpm).toBeGreaterThan(0);
      expect(parts.flatMap((p) => p.notes).length).toBeGreaterThan(0);
      parts.forEach(({ notes, beats }) => {
        notes.forEach((n) => {
          expect(n.midi).toBeGreaterThanOrEqual(PIANO_LOWEST_MIDI);
          expect(n.midi).toBeLessThanOrEqual(PIANO_HIGHEST_MIDI);
        });
        // A piece that ends mid-bar stumbles every time it loops round
        expect(beats % bar).toBeCloseTo(0, 9);
        // Both hands must be the same length, or one would run out early
        expect(beats).toBe(parts[0].beats);
      });
    }
  );

  it('labels every song with where its notes come from', () => {
    SONGS.forEach((song) => {
      expect(song.attribution.length).toBeGreaterThan(10);
      expect(song.categories.length).toBeGreaterThan(0);
    });
    // Riffs from copyrighted songs must say they are by ear, not a transcription
    SONGS.filter((s) => s.source === 'riff').forEach((s) => expect(s.attribution).toMatch(/by ear/));
  });

  it('fills every category with at least three songs', () => {
    CATEGORIES.forEach(({ id }) => expect(SONGS.filter((s) => s.categories.includes(id)).length).toBeGreaterThanOrEqual(3));
  });

  it('keeps the original riffs, including Tokyo Drift and the DJ Snake tracks', () => {
    expect(getSong('tokyo-drift')?.title).toBe('Tokyo Drift');
    expect(SONGS.filter((s) => s.artist.includes('DJ Snake')).length).toBeGreaterThanOrEqual(2);
    expect(getSong('nope')).toBeUndefined();
  });

  it('measures bars in quarter-note beats', () => {
    expect(beatsPerBar('4/4')).toBe(4);
    expect(beatsPerBar('6/8')).toBe(3);
    expect(beatsPerBar('3/8')).toBe(1.5);
    expect(beatsPerBar('2/4')).toBe(2);
  });
});

describe('songTimeline', () => {
  const song: Song = {
    id: 't',
    title: 'Test',
    artist: 'Test',
    categories: ['exercise'],
    difficulty: 'beginner',
    bpm: 120,
    timeSignature: '4/4',
    parts: ['C4/4 E4/4 R/2', 'C3/1'],
    source: 'original',
    attribution: 'A test song for the timeline',
  };

  it('times both hands in seconds, with gaps so repeated notes strike again', () => {
    const { notes, duration } = songTimeline(song);
    expect(notes.map((n) => [n.midi, n.startTime])).toEqual([
      [48, 0],
      [60, 0],
      [64, 0.5],
    ]);
    expect(notes[1].endTime).toBeCloseTo(0.5 * SONG_GATE);
    expect(duration).toBe(2); // a whole bar, trailing rest included
  });

  it('caches the timeline', () => {
    expect(songTimeline(song)).toBe(songTimeline(song));
  });

  it('works for every song in the library', () => {
    SONGS.forEach((s) => {
      const { notes, duration } = songTimeline(s);
      expect(duration).toBeGreaterThan(0);
      expect(notes.every((n) => n.endTime <= duration + 1e-9)).toBe(true);
    });
  });
});

describe('filterSongs', () => {
  it('finds songs by title, artist or category, ignoring case and accents', () => {
    expect(filterSongs(SONGS, { query: 'fur elise' }).map((s) => s.id)).toEqual(['fur-elise']);
    expect(filterSongs(SONGS, { query: 'BEETHOVEN' }).length).toBeGreaterThanOrEqual(3);
    expect(filterSongs(SONGS, { query: 'snake lean' }).map((s) => s.id)).toEqual(['lean-on']);
  });

  it('filters by category and difficulty', () => {
    const classical = filterSongs(SONGS, { category: 'classical' });
    expect(classical.every((s) => s.categories.includes('classical'))).toBe(true);
    const easy = filterSongs(SONGS, { difficulty: 'beginner' });
    expect(easy.every((s) => s.difficulty === 'beginner')).toBe(true);
    expect(filterSongs(SONGS, { category: 'all', difficulty: 'all' })).toHaveLength(SONGS.length);
  });

  it('shows the curated pool and favorites', () => {
    expect(filterSongs(SONGS, { category: 'curated' }).every((s) => s.curated)).toBe(true);
    expect(filterSongs(SONGS, { only: new Set(['twinkle']) }).map((s) => s.id)).toEqual(['twinkle']);
  });

  it('finds nothing for nonsense', () => {
    expect(filterSongs(SONGS, { query: 'zzzz' })).toEqual([]);
  });
});

describe('curatedPicks', () => {
  it('picks a few curated songs, the same ones for the same seed', () => {
    const picks = curatedPicks(SONGS, 1);
    expect(picks).toHaveLength(CURATED_PICKS.count);
    expect(picks.every((s) => s.curated)).toBe(true);
    expect(curatedPicks(SONGS, 1)).toEqual(picks);
  });

  it('shuffles to a different selection with another seed', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 10; seed++) seen.add(curatedPicks(SONGS, seed).map((s) => s.id).join());
    expect(seen.size).toBeGreaterThan(1);
  });
});
