/**
 * @fileoverview The songs of the Notes library (data only).
 *
 * Content rules (see `songs.ts` for the format and the labels):
 * - **Riffs** from copyrighted songs are short hooks, simplified by ear,
 *   and say so. They are not transcriptions of the recordings.
 * - **Public-domain** pieces are long out of copyright; arrangements are
 *   simplified and say how.
 * - **Originals** were written for FunKeys.
 *
 * To add a song, add an entry: the tests check that every part parses,
 * that the parts are the same length in whole bars, and that every note
 * is on an 88-key piano.
 */

import { Song } from './songs';

export const SONGS: readonly Song[] = [
  // ── Riffs (copyrighted songs: short hooks, simplified by ear) ──────────
  {
    id: 'tokyo-drift',
    title: 'Tokyo Drift',
    artist: 'Teriyaki Boyz',
    categories: ['viral', 'soundtrack'],
    difficulty: 'beginner',
    bpm: 130,
    timeSignature: '4/4',
    // The 3 + 3 + 2 stab that drives the whole track
    parts: ['A#4/8. B4/8. D#5/8 A#4/4 A#4/4'],
    source: 'riff',
    attribution: 'From The Fast and the Furious: Tokyo Drift (2006). A short riff simplified by ear, not a transcription.',
    loop: true,
    curated: true,
  },
  {
    id: 'lean-on',
    title: 'Lean On',
    artist: 'Major Lazer & DJ Snake',
    categories: ['popular', 'viral'],
    difficulty: 'intermediate',
    bpm: 98,
    timeSignature: '4/4',
    // The vocal-chop drop, an octave down; the second phrase answers the first
    parts: [
      `
      A#4/4 C5/2 R/4         | D5/4 C5/8 G4/4. A#4/8 G4/8 | A#4/4 G4/8 G4/4 G4/4 F4/8 | A#4/4 G4/2.
      D5/4 C5/2 R/4          | D5/8 D5/8 C5/8 G4/4. A#4/8 G4/8 | A#4/4 G4/8 G4/4 G4/4 F4/8 | A#4/4 G4/2.
      `,
    ],
    source: 'riff',
    attribution: 'Major Lazer & DJ Snake feat. MØ (2015). The vocal-chop hook, an octave down, simplified by ear.',
    loop: true,
    curated: true,
  },
  {
    id: 'taki-taki',
    title: 'Taki Taki',
    artist: 'DJ Snake',
    categories: ['popular', 'viral'],
    difficulty: 'intermediate',
    bpm: 96,
    timeSignature: '4/4',
    parts: ['C#5/16 C#5/8 E5/16 F#5/16 G#5/8 E5/16 F#5/8 F#5/16 G#5/16 C#5/8 B4/8'],
    source: 'riff',
    attribution: 'DJ Snake feat. Selena Gomez, Ozuna & Cardi B (2018). The hook, simplified by ear.',
    loop: true,
    curated: true,
  },
  {
    id: 'megalovania',
    title: 'Megalovania',
    artist: 'Toby Fox',
    categories: ['anime-game', 'viral'],
    difficulty: 'intermediate',
    bpm: 120,
    timeSignature: '4/4',
    // Same answer phrase over a bass note that steps down: D, C, B, B♭
    parts: [
      `
      D4/16 D4/16 D5/8 A4/8. G#4/8 G4/8 F4/8 D4/16 F4/16 G4/16 |
      C4/16 C4/16 D5/8 A4/8. G#4/8 G4/8 F4/8 D4/16 F4/16 G4/16 |
      B3/16 B3/16 D5/8 A4/8. G#4/8 G4/8 F4/8 D4/16 F4/16 G4/16 |
      A#3/16 A#3/16 D5/8 A4/8. G#4/8 G4/8 F4/8 D4/16 F4/16 G4/16
      `,
    ],
    source: 'riff',
    attribution: 'From the game Undertale (2015). The opening riff, simplified by ear.',
    loop: true,
    curated: true,
  },
  {
    id: 'axel-f',
    title: 'Axel F',
    artist: 'Harold Faltermeyer',
    categories: ['soundtrack', 'viral'],
    difficulty: 'intermediate',
    bpm: 117,
    timeSignature: '4/4',
    // The last F rings across the bar line, so bars 3–4 are written as one
    parts: [
      `
      F4/4 G#4/8. F4/8 F4/16 A#4/8 F4/8 D#4/8 |
      F4/4 C5/8. F4/8 F4/16 C#5/8 C5/8 G#4/8 |
      F4/8 C5/8 F5/8 F4/16 D#4/8 D#4/16 C4/8 G4/8 F4/2. R/4.
      `,
    ],
    source: 'riff',
    attribution: 'From Beverly Hills Cop (1984). The synth hook, simplified by ear.',
    loop: true,
    curated: true,
  },
  {
    id: 'seven-nation-army',
    title: 'Seven Nation Army',
    artist: 'The White Stripes',
    categories: ['popular', 'beginner'],
    difficulty: 'beginner',
    bpm: 124,
    timeSignature: '4/4',
    // Played on guitar an octave lower
    parts: ['E4/4. E4/8 G4/8. E4/8. D4/8 | C4/2 B3/2'],
    source: 'riff',
    attribution: 'The White Stripes (2003). The guitar riff, an octave up, simplified by ear.',
    loop: true,
    curated: true,
  },
  {
    id: 'pirates',
    title: "He's a Pirate",
    artist: 'Klaus Badelt',
    categories: ['soundtrack'],
    difficulty: 'intermediate',
    bpm: 132,
    timeSignature: '6/8',
    parts: [
      `
      A3/16 C4/16 D4/8 D4/8 D4/16 E4/16 F4/8 F4/8 | F4/16 G4/16 E4/8 E4/8 D4/16 C4/16 D4/4 |
      A3/16 C4/16 D4/8 D4/8 D4/16 E4/16 F4/8 F4/8 | F4/16 G4/16 E4/8 E4/8 D4/16 C4/16 D4/4 |
      A3/16 C4/16 D4/8 D4/8 D4/16 F4/16 G4/8 G4/8 | G4/16 A4/16 A#4/8 A#4/8 A4/16 G4/16 A4/8 D4/8 |
      D4/16 E4/16 F4/8 F4/8 G4/8 A4/8 D4/8 | D4/16 F4/16 E4/8 E4/8 F4/16 D4/16 E4/4
      `,
    ],
    source: 'riff',
    attribution: 'From Pirates of the Caribbean (2003). The main theme, simplified by ear.',
    loop: true,
    curated: true,
  },

  // ── Public domain ──────────────────────────────────────────────────────
  {
    id: 'fur-elise',
    title: 'Für Elise',
    artist: 'Ludwig van Beethoven',
    categories: ['classical', 'advanced'],
    difficulty: 'intermediate',
    bpm: 75,
    timeSignature: '3/8',
    // Starts on the first full bar; the E5 D♯5 pickup closes the loop instead
    parts: [
      `
      E5/16 D#5/16 E5/16 B4/16 D5/16 C5/16 | A4/8 R/16 C4/16 E4/16 A4/16 |
      B4/8 R/16 E4/16 G#4/16 B4/16 | C5/8 R/16 E4/16 E5/16 D#5/16 |
      E5/16 D#5/16 E5/16 B4/16 D5/16 C5/16 | A4/8 R/16 C4/16 E4/16 A4/16 |
      B4/8 R/16 E4/16 C5/16 B4/16 | A4/8 R/8 E5/16 D#5/16
      `,
      // Left hand: the broken chords under each long note
      `
      R/4. | A2/16 E3/16 A3/16 R/16 R/8 |
      E2/16 E3/16 G#3/16 R/16 R/8 | A2/16 E3/16 A3/16 R/16 R/8 |
      R/4. | A2/16 E3/16 A3/16 R/16 R/8 |
      E2/16 E3/16 G#3/16 R/16 R/8 | A2/16 E3/16 A3/16 R/16 R/8
      `,
    ],
    source: 'public-domain',
    attribution: 'Bagatelle No. 25 in A minor (1810). Public domain. The opening theme, both hands.',
    loop: true,
    curated: true,
  },
  {
    id: 'ode-to-joy',
    title: 'Ode to Joy',
    artist: 'Ludwig van Beethoven',
    categories: ['classical', 'beginner'],
    difficulty: 'beginner',
    bpm: 108,
    timeSignature: '4/4',
    parts: [
      `
      E4/4 E4/4 F4/4 G4/4 | G4/4 F4/4 E4/4 D4/4 | C4/4 C4/4 D4/4 E4/4 | E4/4. D4/8 D4/2 |
      E4/4 E4/4 F4/4 G4/4 | G4/4 F4/4 E4/4 D4/4 | C4/4 C4/4 D4/4 E4/4 | D4/4. C4/8 C4/2
      `,
      'C3/1 | G2/1 | C3/1 | G2/2 G2/2 | C3/1 | G2/1 | C3/1 | G2/2 C3/2',
    ],
    source: 'public-domain',
    attribution: 'From Symphony No. 9 (1824). Public domain. Simplified: the melody over a simple bass.',
    curated: true,
  },
  {
    id: 'twinkle',
    title: 'Twinkle, Twinkle, Little Star',
    artist: 'Traditional',
    categories: ['beginner'],
    difficulty: 'beginner',
    bpm: 96,
    timeSignature: '4/4',
    parts: [
      `
      C4/4 C4/4 G4/4 G4/4 | A4/4 A4/4 G4/2 | F4/4 F4/4 E4/4 E4/4 | D4/4 D4/4 C4/2 |
      G4/4 G4/4 F4/4 F4/4 | E4/4 E4/4 D4/2 | G4/4 G4/4 F4/4 F4/4 | E4/4 E4/4 D4/2 |
      C4/4 C4/4 G4/4 G4/4 | A4/4 A4/4 G4/2 | F4/4 F4/4 E4/4 E4/4 | D4/4 D4/4 C4/2
      `,
    ],
    source: 'public-domain',
    attribution: 'French melody "Ah ! vous dirai-je, maman" (1761). Public domain. Right hand only.',
  },
  {
    id: 'mary-lamb',
    title: 'Mary Had a Little Lamb',
    artist: 'Traditional',
    categories: ['beginner'],
    difficulty: 'beginner',
    bpm: 112,
    timeSignature: '4/4',
    parts: [
      `
      E4/4 D4/4 C4/4 D4/4 | E4/4 E4/4 E4/2 | D4/4 D4/4 D4/2 | E4/4 G4/4 G4/2 |
      E4/4 D4/4 C4/4 D4/4 | E4/4 E4/4 E4/4 E4/4 | D4/4 D4/4 E4/4 D4/4 | C4/1
      `,
    ],
    source: 'public-domain',
    attribution: 'American nursery song (1830s). Public domain. Right hand only, three notes plus one.',
  },
  {
    id: 'jingle-bells',
    title: 'Jingle Bells',
    artist: 'James Lord Pierpont',
    categories: ['beginner', 'popular'],
    difficulty: 'beginner',
    bpm: 120,
    timeSignature: '4/4',
    parts: [
      `
      E4/4 E4/4 E4/2 | E4/4 E4/4 E4/2 | E4/4 G4/4 C4/4. D4/8 | E4/1 |
      F4/4 F4/4 F4/4. F4/8 | F4/4 E4/4 E4/4 E4/8 E4/8 | E4/4 D4/4 D4/4 E4/4 | D4/2 G4/2 |
      E4/4 E4/4 E4/2 | E4/4 E4/4 E4/2 | E4/4 G4/4 C4/4. D4/8 | E4/1 |
      F4/4 F4/4 F4/4. F4/8 | F4/4 E4/4 E4/4 E4/8 E4/8 | G4/4 G4/4 F4/4 D4/4 | C4/1
      `,
    ],
    source: 'public-domain',
    attribution: 'James Lord Pierpont (1857). Public domain. The chorus, right hand.',
  },
  {
    id: 'minuet-in-g',
    title: 'Minuet in G',
    artist: 'Christian Petzold',
    categories: ['classical', 'advanced'],
    difficulty: 'intermediate',
    bpm: 120,
    timeSignature: '3/4',
    parts: [
      `
      D5/4 G4/8 A4/8 B4/8 C5/8 | D5/4 G4/4 G4/4 | E5/4 C5/8 D5/8 E5/8 F#5/8 | G5/4 G4/4 G4/4 |
      C5/4 D5/8 C5/8 B4/8 A4/8 | B4/4 C5/8 B4/8 A4/8 G4/8 | F#4/4 G4/8 A4/8 B4/8 G4/8 | A4/2. |
      D5/4 G4/8 A4/8 B4/8 C5/8 | D5/4 G4/4 G4/4 | E5/4 C5/8 D5/8 E5/8 F#5/8 | G5/4 G4/4 G4/4 |
      C5/4 D5/8 C5/8 B4/8 A4/8 | B4/4 C5/8 B4/8 A4/8 G4/8 | A4/4 B4/8 A4/8 G4/8 F#4/8 | G4/2.
      `,
      `
      G3/2. | B3/2. | C4/2. | B3/2. | A3/2. | G3/2. | D3/2. | D3/4 F#3/4 A3/4 |
      G3/2. | B3/2. | C4/2. | B3/2. | A3/2. | G3/2. | C4/4 D4/4 D3/4 | G3/2 G2/4
      `,
    ],
    source: 'public-domain',
    attribution:
      'Minuet in G major, BWV Anh. 114 (c. 1725), long credited to J. S. Bach. Public domain. Simplified left hand.',
  },
  {
    id: 'canon-in-d',
    title: 'Canon in D',
    artist: 'Johann Pachelbel',
    categories: ['classical', 'advanced'],
    difficulty: 'intermediate',
    bpm: 66,
    timeSignature: '4/4',
    parts: [
      `
      F#5/2 E5/2 | D5/2 C#5/2 | B4/2 A4/2 | B4/2 C#5/2 |
      D5/2 C#5/2 | B4/2 A4/2 | G4/2 F#4/2 | G4/2 E4/2 |
      D5/4 F#5/4 A5/4 G5/4 | F#5/4 D5/4 F#5/4 E5/4 | D5/4 B4/4 D5/4 A5/4 | G5/4 B5/4 A5/4 G5/4 |
      F#4+A4+D5/1
      `,
      // The ground bass, eight notes repeated under every phrase
      `
      D3/2 A2/2 | B2/2 F#2/2 | G2/2 D2/2 | G2/2 A2/2 |
      D3/2 A2/2 | B2/2 F#2/2 | G2/2 D2/2 | G2/2 A2/2 |
      D3/2 A2/2 | B2/2 F#2/2 | G2/2 D2/2 | G2/2 A2/2 |
      D2+D3/1
      `,
    ],
    source: 'public-domain',
    attribution:
      'Canon in D (c. 1680–1706). Public domain. Simplified for two hands: the ground bass under the first three violin phrases.',
    curated: true,
  },
  {
    id: 'mountain-king',
    title: 'In the Hall of the Mountain King',
    artist: 'Edvard Grieg',
    categories: ['classical', 'beginner'],
    difficulty: 'beginner',
    bpm: 120,
    timeSignature: '4/4',
    parts: [
      `
      B3/8 C#4/8 D4/8 E4/8 F#4/8 D4/8 F#4/4 | F4/8 C#4/8 F4/4 E4/8 C4/8 E4/4 |
      B3/8 C#4/8 D4/8 E4/8 F#4/8 D4/8 F#4/8 B4/8 | A4/8 F#4/8 D4/8 F#4/8 A4/2
      `,
    ],
    source: 'public-domain',
    attribution: 'From Peer Gynt (1875). Public domain. The opening theme, which loops as it does in the piece.',
    loop: true,
    curated: true,
  },
  {
    id: 'korobeiniki',
    title: 'Korobeiniki',
    artist: 'Russian folk song',
    categories: ['anime-game', 'popular'],
    difficulty: 'intermediate',
    bpm: 144,
    timeSignature: '4/4',
    parts: [
      `
      E5/4 B4/8 C5/8 D5/4 C5/8 B4/8 | A4/4 A4/8 C5/8 E5/4 D5/8 C5/8 | B4/4. C5/8 D5/4 E5/4 | C5/4 A4/4 A4/2 |
      D5/4. F5/8 A5/4 G5/8 F5/8 | E5/4. C5/8 E5/4 D5/8 C5/8 | B4/4 B4/8 C5/8 D5/4 E5/4 | C5/4 A4/4 A4/2
      `,
      'E3/2 G#3/2 | A2/2 A3/2 | G#3/2 E3/2 | A2/2 A3/2 | D3/2 F3/2 | C3/2 E3/2 | B2/2 G#3/2 | A2/1',
    ],
    source: 'public-domain',
    attribution:
      'Russian folk song (1861), the melody known from Tetris. Public domain. A simple arrangement of the folk tune, not the game’s soundtrack.',
    loop: true,
    curated: true,
  },
  {
    id: 'prelude-in-c',
    title: 'Prelude in C',
    artist: 'Johann Sebastian Bach',
    categories: ['classical', 'advanced'],
    difficulty: 'intermediate',
    bpm: 66,
    timeSignature: '4/4',
    // Each bar is one chord, broken into the same 8-note figure played twice
    parts: [
      `
      C4/16 E4/16 G4/16 C5/16 E5/16 G4/16 C5/16 E5/16 C4/16 E4/16 G4/16 C5/16 E5/16 G4/16 C5/16 E5/16 |
      C4/16 D4/16 A4/16 D5/16 F5/16 A4/16 D5/16 F5/16 C4/16 D4/16 A4/16 D5/16 F5/16 A4/16 D5/16 F5/16 |
      B3/16 D4/16 G4/16 D5/16 F5/16 G4/16 D5/16 F5/16 B3/16 D4/16 G4/16 D5/16 F5/16 G4/16 D5/16 F5/16 |
      C4/16 E4/16 G4/16 C5/16 E5/16 G4/16 C5/16 E5/16 C4/16 E4/16 G4/16 C5/16 E5/16 G4/16 C5/16 E5/16 |
      C4/16 E4/16 A4/16 E5/16 A5/16 A4/16 E5/16 A5/16 C4/16 E4/16 A4/16 E5/16 A5/16 A4/16 E5/16 A5/16 |
      C4/16 D4/16 F#4/16 A4/16 D5/16 F#4/16 A4/16 D5/16 C4/16 D4/16 F#4/16 A4/16 D5/16 F#4/16 A4/16 D5/16 |
      B3/16 D4/16 G4/16 D5/16 G5/16 G4/16 D5/16 G5/16 B3/16 D4/16 G4/16 D5/16 G5/16 G4/16 D5/16 G5/16 |
      B3/16 C4/16 E4/16 G4/16 C5/16 E4/16 G4/16 C5/16 B3/16 C4/16 E4/16 G4/16 C5/16 E4/16 G4/16 C5/16 |
      A3/16 C4/16 E4/16 G4/16 C5/16 E4/16 G4/16 C5/16 A3/16 C4/16 E4/16 G4/16 C5/16 E4/16 G4/16 C5/16 |
      D3/16 A3/16 D4/16 F#4/16 C5/16 D4/16 F#4/16 C5/16 D3/16 A3/16 D4/16 F#4/16 C5/16 D4/16 F#4/16 C5/16 |
      G3/16 B3/16 D4/16 G4/16 B4/16 D4/16 G4/16 B4/16 G3/16 B3/16 D4/16 G4/16 B4/16 D4/16 G4/16 B4/16 |
      C3+G3+C4+E4/1
      `,
    ],
    source: 'public-domain',
    attribution:
      'Prelude in C major, BWV 846 (1722). Public domain. The first eleven bars, simplified: the held bass notes are played as plain broken chords.',
  },
  {
    id: 'moonlight',
    title: 'Moonlight Sonata (opening)',
    artist: 'Ludwig van Beethoven',
    categories: ['classical', 'advanced'],
    difficulty: 'advanced',
    bpm: 56,
    timeSignature: '4/4',
    parts: [
      // Triplets over a slow bass, four groups to a bar
      `
      G#3/8t C#4/8t E4/8t G#3/8t C#4/8t E4/8t G#3/8t C#4/8t E4/8t G#3/8t C#4/8t E4/8t |
      G#3/8t C#4/8t E4/8t G#3/8t C#4/8t E4/8t G#3/8t C#4/8t E4/8t G#3/8t C#4/8t E4/8t |
      A3/8t C#4/8t E4/8t A3/8t C#4/8t E4/8t A3/8t D4/8t F#4/8t A3/8t D4/8t F#4/8t |
      G#3/8t C4/8t F#4/8t G#3/8t C#4/8t E4/8t G#3/8t C#4/8t D#4/8t F#3/8t C4/8t D#4/8t |
      G#3/8t C#4/8t E4/8t G#3/8t C#4/8t E4/8t G#3/8t C#4/8t E4/8t G#3/8t C#4/8t E4/8t
      `,
      'C#2+C#3/1 | B1+B2/1 | A1+A2/2 F#1+F#2/2 | G#1+G#2/1 | C#2+C#3/1',
    ],
    source: 'public-domain',
    attribution:
      'Piano Sonata No. 14, first movement (1801). Public domain. The opening bars (B♯ is written as C).',
  },
  {
    id: 'greensleeves',
    title: 'Greensleeves',
    artist: 'English folk song',
    categories: ['classical'],
    difficulty: 'intermediate',
    bpm: 100,
    timeSignature: '3/4',
    parts: [
      `
      R/2 A4/4 | C5/2 D5/4 | E5/4. F5/8 E5/4 | D5/2 B4/4 | G4/4. A4/8 B4/4 | C5/2 A4/4 |
      A4/4. G#4/8 A4/4 | B4/2 G#4/4 | E4/2 A4/4 | C5/2 D5/4 | E5/4. F5/8 E5/4 | D5/2 B4/4 |
      G4/4. A4/8 B4/4 | C5/4. B4/8 A4/4 | G#4/4. F#4/8 G#4/4 | A4/2.
      `,
    ],
    source: 'public-domain',
    attribution: 'English folk song (16th century). Public domain. The melody, starting from its pickup.',
  },
  {
    id: 'sakura',
    title: 'Sakura Sakura',
    artist: 'Japanese folk song',
    categories: ['beginner'],
    difficulty: 'beginner',
    bpm: 72,
    timeSignature: '4/4',
    parts: [
      `
      A4/4 A4/4 B4/2 | A4/4 A4/4 B4/2 | A4/4 B4/4 C5/4 B4/4 | A4/4 B4/8 A4/8 F4/2 |
      E4/4 C4/4 E4/4 F4/4 | E4/4 E4/8 C4/8 B3/2 | A4/4 B4/4 C5/4 B4/4 | A4/4 B4/8 A4/8 F4/2 |
      E4/4 C4/4 E4/4 F4/4 | E4/4 E4/8 C4/8 B3/2 | A4/4 A4/4 B4/2 | A4/4 A4/4 B4/2 |
      E4/4 F4/4 B4/8 A4/8 F4/4 | E4/1
      `,
    ],
    source: 'public-domain',
    attribution: 'Japanese folk song (Edo period). Public domain. The melody, right hand.',
  },
  {
    id: 'hanon-1',
    title: 'Hanon Exercise No. 1',
    artist: 'Charles-Louis Hanon',
    categories: ['exercise'],
    difficulty: 'intermediate',
    bpm: 72,
    timeSignature: '2/4',
    // The same five-finger figure, one step higher each bar; left hand an octave below
    parts: [
      `
      C4/16 E4/16 F4/16 G4/16 A4/16 G4/16 F4/16 E4/16 | D4/16 F4/16 G4/16 A4/16 B4/16 A4/16 G4/16 F4/16 |
      E4/16 G4/16 A4/16 B4/16 C5/16 B4/16 A4/16 G4/16 | F4/16 A4/16 B4/16 C5/16 D5/16 C5/16 B4/16 A4/16 |
      G4/16 B4/16 C5/16 D5/16 E5/16 D5/16 C5/16 B4/16 | A4/16 C5/16 D5/16 E5/16 F5/16 E5/16 D5/16 C5/16 |
      B4/16 D5/16 E5/16 F5/16 G5/16 F5/16 E5/16 D5/16 | C5/2
      `,
      `
      C3/16 E3/16 F3/16 G3/16 A3/16 G3/16 F3/16 E3/16 | D3/16 F3/16 G3/16 A3/16 B3/16 A3/16 G3/16 F3/16 |
      E3/16 G3/16 A3/16 B3/16 C4/16 B3/16 A3/16 G3/16 | F3/16 A3/16 B3/16 C4/16 D4/16 C4/16 B3/16 A3/16 |
      G3/16 B3/16 C4/16 D4/16 E4/16 D4/16 C4/16 B3/16 | A3/16 C4/16 D4/16 E4/16 F4/16 E4/16 D4/16 C4/16 |
      B3/16 D4/16 E4/16 F4/16 G4/16 F4/16 E4/16 D4/16 | C4/2
      `,
    ],
    source: 'public-domain',
    attribution: 'From The Virtuoso Pianist (1873). Public domain. The ascending half, hands an octave apart.',
    loop: true,
  },

  // ── Originals, written for FunKeys ─────────────────────────────────────
  {
    id: 'c-major-scale',
    title: 'C major scale',
    artist: 'FunKeys',
    categories: ['exercise', 'beginner'],
    difficulty: 'beginner',
    bpm: 80,
    timeSignature: '4/4',
    parts: [
      'C4/8 D4/8 E4/8 F4/8 G4/8 A4/8 B4/8 C5/8 | C5/8 B4/8 A4/8 G4/8 F4/8 E4/8 D4/8 C4/8',
      'C3/8 D3/8 E3/8 F3/8 G3/8 A3/8 B3/8 C4/8 | C4/8 B3/8 A3/8 G3/8 F3/8 E3/8 D3/8 C3/8',
    ],
    source: 'original',
    attribution: 'Original exercise. One octave up and down, hands together an octave apart.',
    loop: true,
  },
  {
    id: 'chromatic-scale',
    title: 'Chromatic scale',
    artist: 'FunKeys',
    categories: ['exercise'],
    difficulty: 'beginner',
    bpm: 84,
    timeSignature: '4/4',
    parts: [
      `
      C4/8 C#4/8 D4/8 D#4/8 E4/8 F4/8 F#4/8 G4/8 | G#4/8 A4/8 A#4/8 B4/8 C5/2 |
      C5/8 B4/8 A#4/8 A4/8 G#4/8 G4/8 F#4/8 F4/8 | E4/8 D#4/8 D4/8 C#4/8 C4/2
      `,
    ],
    source: 'original',
    attribution: 'Original exercise. Every key, white and black, up an octave and back.',
    loop: true,
  },
  {
    id: 'pop-progression',
    title: 'The pop progression (I–V–vi–IV)',
    artist: 'FunKeys',
    categories: ['exercise', 'popular', 'beginner'],
    difficulty: 'beginner',
    bpm: 92,
    timeSignature: '4/4',
    parts: [
      'C4+E4+G4/2 C4+E4+G4/2 | B3+D4+G4/2 B3+D4+G4/2 | C4+E4+A4/2 C4+E4+A4/2 | C4+F4+A4/2 C4+F4+A4/2',
      'C3/1 | G2/1 | A2/1 | F2/1',
    ],
    source: 'original',
    attribution: 'Original exercise. C, G, A minor and F: the four-chord loop behind countless pop songs.',
    loop: true,
  },
  {
    id: 'arpeggios',
    title: 'Broken chords in C, F and G',
    artist: 'FunKeys',
    categories: ['exercise'],
    difficulty: 'intermediate',
    bpm: 96,
    timeSignature: '4/4',
    parts: [
      `
      C4/8 E4/8 G4/8 C5/8 E5/8 C5/8 G4/8 E4/8 | F4/8 A4/8 C5/8 F5/8 A5/8 F5/8 C5/8 A4/8 |
      G4/8 B4/8 D5/8 G5/8 B5/8 G5/8 D5/8 B4/8 | C5/8 G4/8 E4/8 G4/8 C4/2
      `,
      'C3/1 | F2/1 | G2/1 | C3/1',
    ],
    source: 'original',
    attribution: 'Original exercise. Arpeggios over the three main chords of C major.',
    loop: true,
  },
  {
    id: 'alberti-bass',
    title: 'Alberti bass study',
    artist: 'FunKeys',
    categories: ['exercise', 'advanced'],
    difficulty: 'intermediate',
    bpm: 88,
    timeSignature: '4/4',
    parts: [
      'E5/2 D5/2 | C5/2 B4/2 | C5/2 D5/2 | C5/1',
      `
      C3/8 G3/8 E3/8 G3/8 C3/8 G3/8 E3/8 G3/8 | B2/8 G3/8 D3/8 G3/8 B2/8 G3/8 D3/8 G3/8 |
      C3/8 G3/8 E3/8 G3/8 B2/8 G3/8 F3/8 G3/8 | C3/8 G3/8 E3/8 G3/8 C3/2
      `,
    ],
    source: 'original',
    attribution: 'Original exercise. The low-high-middle-high left-hand pattern of Classical-era sonatas.',
    loop: true,
  },
  {
    id: 'pixel-quest',
    title: 'Pixel Quest',
    artist: 'FunKeys',
    categories: ['anime-game'],
    difficulty: 'intermediate',
    bpm: 140,
    timeSignature: '4/4',
    parts: [
      `
      A4/8 C5/8 E5/8 A5/8 G5/8 E5/8 C5/8 E5/8 | F5/8 D5/8 A4/8 D5/8 F5/4 E5/4 |
      G4/8 B4/8 D5/8 G5/8 F5/8 D5/8 B4/8 D5/8 | E5/4 C5/8 B4/8 A4/2
      `,
      'A2/4 A3/4 A2/4 A3/4 | D3/4 D4/4 D3/4 D4/4 | G2/4 G3/4 G2/4 G3/4 | E2/4 E3/4 A2/2',
    ],
    source: 'original',
    attribution: 'Original étude in the style of a retro game theme.',
    loop: true,
  },
];

/** Look up a song by id */
export function getSong(id: string): Song | undefined {
  return SONGS.find((s) => s.id === id);
}
