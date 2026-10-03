/**
 * @fileoverview The piano keyboard: lays out white and black keys.
 *
 * White keys sit side by side in a flex row. Black keys are absolutely
 * positioned on the boundary after the white key they follow, e.g. C#
 * sits between C and D:
 *
 * ```
 *   left = whiteKeyWidth × (number of white keys before it)
 *   ┌──┬█┬──┬█┬──┬──┬█┬──┬█┬──┬█┬──┐
 *   │C │ │D │ │E │F │ │G │ │A │ │B │
 *   └──┴─┴──┴─┴──┴──┴─┴──┴─┴──┴─┴──┘
 * ```
 *
 * Key dimensions are CSS variables computed from the viewport width, so
 * the whole keyboard scales down to fit phones without horizontal scroll.
 */

'use client';

import { CSSProperties, useMemo } from 'react';
import { Note, PianoProps } from '@/types';
import {
  WHITE_KEY_WIDTH,
  MIN_WHITE_KEY_WIDTH,
  WHITE_KEY_HEIGHT,
  MIN_WHITE_KEY_HEIGHT,
  BLACK_KEY_WIDTH_RATIO,
  BLACK_KEY_HEIGHT_RATIO,
} from '@/lib/constants';
import PianoKey from './PianoKey';

/** Horizontal space around the keyboard (page gutters + piano frame padding) */
const HORIZONTAL_CHROME = '4rem';

export default function Piano({
  notes,
  activeNoteIds,
  sustainedNoteIds,
  onNoteStart,
  onNoteStop,
}: PianoProps) {
  /** Split notes into white keys and black keys with their horizontal offsets */
  const { whiteKeys, blackKeys } = useMemo(() => {
    const whiteKeys: Note[] = [];
    const blackKeys: Array<{ note: Note; whiteKeysBefore: number }> = [];

    notes.forEach((note) => {
      if (note.isBlack) {
        blackKeys.push({ note, whiteKeysBefore: whiteKeys.length });
      } else {
        whiteKeys.push(note);
      }
    });

    return { whiteKeys, blackKeys };
  }, [notes]);

  const sizeVariables = {
    '--white-key-width': `clamp(${MIN_WHITE_KEY_WIDTH}px, calc((100vw - ${HORIZONTAL_CHROME}) / ${whiteKeys.length}), ${WHITE_KEY_WIDTH}px)`,
    '--white-key-height': `clamp(${MIN_WHITE_KEY_HEIGHT}px, calc(var(--white-key-width) * ${WHITE_KEY_HEIGHT / WHITE_KEY_WIDTH}), ${WHITE_KEY_HEIGHT}px)`,
    '--black-key-width': `calc(var(--white-key-width) * ${BLACK_KEY_WIDTH_RATIO})`,
    '--black-key-height': `calc(var(--white-key-height) * ${BLACK_KEY_HEIGHT_RATIO})`,
  } as CSSProperties;

  return (
    <div className="w-full overflow-x-auto">
      <div
        className="mx-auto w-max rounded-2xl border border-white/10 bg-linear-to-b from-zinc-800 to-zinc-950 px-2 pb-3 shadow-2xl shadow-purple-950/40 sm:px-3"
        style={sizeVariables}
      >
        {/* Felt strip above the keys, like on a real piano */}
        <div className="mb-px h-3 rounded-b-sm bg-linear-to-b from-red-900 to-red-950" />

        <div className="relative flex" role="group" aria-label="Piano keyboard">
          {whiteKeys.map((note) => (
            <PianoKey
              // Keyed by computer key so keys stay mounted across octave shifts
              key={note.keyboardKey}
              note={note}
              isActive={activeNoteIds.has(note.id)}
              isSustained={sustainedNoteIds?.has(note.id) ?? false}
              onNoteStart={onNoteStart}
              onNoteStop={onNoteStop}
            />
          ))}

          {blackKeys.map(({ note, whiteKeysBefore }) => (
            <div
              key={note.keyboardKey}
              className="absolute top-0 z-10"
              style={{ left: `calc(var(--white-key-width) * ${whiteKeysBefore})` }}
            >
              <PianoKey
                note={note}
                isActive={activeNoteIds.has(note.id)}
                isSustained={sustainedNoteIds?.has(note.id) ?? false}
                onNoteStart={onNoteStart}
                onNoteStop={onNoteStop}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
