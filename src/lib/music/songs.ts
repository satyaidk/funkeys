/**
 * @fileoverview The Notes library: what a song is, and how to find one.
 *
 * Songs are **data** (see `song-library.ts`), written in the melody format
 * of `sequence.ts`, one text per hand. Nothing here knows about the player
 * or the UI: adding a song means adding an entry, and the tests check that
 * it parses, stays on the piano and fills whole bars.
 *
 * ```
 *   Song.parts (text, beats) ─► parseParts ─► sequenceToNoteEvents ─► PianoNoteEvent[] (seconds)
 * ```
 *
 * ## Honest labels
 * Every song says where its notes come from (`source`), so nobody mistakes
 * an arrangement for a transcription:
 *
 * - `riff`: a short hook from a copyrighted song, simplified by ear
 * - `public-domain`: a piece out of copyright, usually simplified
 * - `original`: written for FunKeys (exercises, études)
 */

import { PianoNoteEvent } from '@/types';
import { SONG_GATE } from '../constants';
import { beatsToSeconds, sequenceToNoteEvents } from './note-events';
import { parseParts } from './sequence';

export type SongCategory =
  | 'popular'
  | 'viral'
  | 'anime-game'
  | 'soundtrack'
  | 'classical'
  | 'beginner'
  | 'advanced'
  | 'exercise';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export type SongSource = 'riff' | 'public-domain' | 'original';

export type TimeSignatureId = '2/4' | '3/4' | '4/4' | '3/8' | '6/8';

export interface Song {
  /** Stable id, used as the React key and the selected value */
  id: string;
  title: string;
  /** Composer or performer */
  artist: string;
  categories: SongCategory[];
  difficulty: Difficulty;
  /** Tempo in quarter-note beats per minute */
  bpm: number;
  timeSignature: TimeSignatureId;
  /** One melody text per hand (right hand first), in `sequence.ts` format */
  parts: string[];
  source: SongSource;
  /** Where it comes from and what kind of arrangement it is */
  attribution: string;
  /** Repeat by default (riffs and exercises) */
  loop?: boolean;
  /** In the pool the "Curated picks" are drawn from */
  curated?: boolean;
}

/** Category names and one-line descriptions, in display order */
export const CATEGORIES: ReadonlyArray<{ id: SongCategory; label: string; description: string }> = [
  { id: 'popular', label: 'Popular melodies', description: 'Hooks and tunes most people know' },
  { id: 'viral', label: 'Viral & short-form', description: 'Riffs that took off on video platforms' },
  { id: 'anime-game', label: 'Anime & games', description: 'Game themes and game-style tunes' },
  { id: 'soundtrack', label: 'Movies & soundtracks', description: 'Film themes' },
  { id: 'classical', label: 'Classical', description: 'Public-domain piano and orchestral classics' },
  { id: 'beginner', label: 'Beginner-friendly', description: 'Easy to follow, one hand or simple bass' },
  { id: 'advanced', label: 'Advanced arrangements', description: 'Both hands, faster figures' },
  { id: 'exercise', label: 'Practice exercises', description: 'Scales, arpeggios and patterns' },
];

export const DIFFICULTIES: ReadonlyArray<{ id: Difficulty; label: string }> = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
];

/** Short labels for where a song's notes come from */
export const SOURCE_LABELS: Record<SongSource, string> = {
  riff: 'Riff, by ear',
  'public-domain': 'Public domain',
  original: 'Original',
};

/** About the curated picks: hand-picked, not live data */
export const CURATED_PICKS = {
  title: 'Curated picks',
  note: 'Hand-picked, recognizable tunes. This is not live chart data.',
  updated: 'October 2026',
  /** How many picks to show at a time */
  count: 6,
} as const;

/** Length of one bar in quarter-note beats, e.g. '6/8' → 3 */
export function beatsPerBar(timeSignature: TimeSignatureId): number {
  const [count, unit] = timeSignature.split('/').map(Number);
  return (count * 4) / unit;
}

export interface SongTimeline {
  notes: PianoNoteEvent[];
  /** Whole bars, trailing rests included, so a loop comes round on the beat */
  duration: number;
}

const timelines = new WeakMap<Song, SongTimeline>();

/**
 * A song's notes in seconds at its own tempo (cached: songs are immutable).
 * @throws Error if a part can't be parsed (the tests make sure none can't)
 */
export function songTimeline(song: Song): SongTimeline {
  let timeline = timelines.get(song);
  if (!timeline) {
    const sequence = parseParts(song.parts);
    timeline = {
      notes: sequenceToNoteEvents(sequence, song.bpm, { gate: SONG_GATE, idPrefix: `${song.id}-` }),
      duration: beatsToSeconds(sequence.beats, song.bpm),
    };
    timelines.set(song, timeline);
  }
  return timeline;
}

export interface SongFilter {
  /** Matches title, artist or category name, ignoring case and accents */
  query?: string;
  /** 'curated' shows the curated pool */
  category?: SongCategory | 'curated' | 'all';
  difficulty?: Difficulty | 'all';
  /** Only these ids (favorites) */
  only?: ReadonlySet<string> | null;
}

/** Lowercase without accents, so "fur elise" finds "Für Elise" */
const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function filterSongs(songs: readonly Song[], filter: SongFilter): Song[] {
  const words = fold(filter.query ?? '')
    .split(/\s+/)
    .filter(Boolean);
  return songs.filter((song) => {
    if (filter.only && !filter.only.has(song.id)) return false;
    if (filter.category === 'curated' && !song.curated) return false;
    if (filter.category && filter.category !== 'all' && filter.category !== 'curated' && !song.categories.includes(filter.category)) {
      return false;
    }
    if (filter.difficulty && filter.difficulty !== 'all' && song.difficulty !== filter.difficulty) return false;
    if (words.length === 0) return true;
    const haystack = fold(
      [song.title, song.artist, ...song.categories.map((c) => CATEGORIES.find((x) => x.id === c)?.label ?? c)].join(' ')
    );
    return words.every((word) => haystack.includes(word));
  });
}

/**
 * A few songs from the curated pool, in an order set by `seed`. Shuffling
 * means picking a new seed; the same seed always gives the same picks.
 */
export function curatedPicks(songs: readonly Song[], seed: number, count: number = CURATED_PICKS.count): Song[] {
  const pool = songs.filter((s) => s.curated);
  // mulberry32: a tiny seeded random number generator
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Fisher–Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
