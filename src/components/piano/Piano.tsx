/**
 * @fileoverview The keyboard: walnut cheeks, a lacquered fallboard with the
 * wordmark, a strip of red felt, and 37 keys.
 *
 * White keys sit side by side; black keys are positioned on the boundary
 * after the white key they follow:
 *
 * ```
 *   left = whiteKeyWidth × (number of white keys before it)
 *   ┌──┬█┬──┬█┬──┬──┬█┬──┬█┬──┬█┬──┐
 *   │C │ │D │ │E │F │ │G │ │A │ │B │
 *   └──┴─┴──┴─┴──┴──┴─┴──┴─┴──┴─┴──┘
 * ```
 *
 * Key sizes are CSS variables computed with clamp() from the viewport width
 * (ADR 0004). Below the minimum key width, the keyboard scrolls sideways and
 * starts centered on middle C.
 *
 * In split mode the fallboard names each hand's voice and a marker shows
 * where the split falls.
 */

'use client';

import { CSSProperties, useEffect, useMemo, useRef } from 'react';
import { Note } from '@/types';
import {
  WHITE_KEY_WIDTH,
  MIN_WHITE_KEY_WIDTH,
  WHITE_KEY_HEIGHT,
  MIN_WHITE_KEY_HEIGHT,
  BLACK_KEY_WIDTH_RATIO,
  BLACK_KEY_HEIGHT_RATIO,
} from '@/lib/constants';
import PianoKey from './PianoKey';

export interface SplitMarker {
  /** Index of the first right-hand key */
  index: number;
  leftLabel: string;
  rightLabel: string;
}

interface PianoProps {
  notes: Note[];
  /** Layout-aware key labels (KeyboardEvent.code → label), when the browser provides them */
  labels?: ReadonlyMap<string, string> | null;
  activeNoteIds: ReadonlySet<string>;
  sustainedNoteIds?: ReadonlySet<string>;
  onNoteOn: (noteId: string, velocity: number) => void;
  onNoteOff: (noteId: string) => void;
  split?: SplitMarker | null;
}

/** Space around the keys: page gutters, cabinet padding and both cheeks */
const HORIZONTAL_CHROME = '9rem';
const MAX_LAYOUT_WIDTH = '1480px';

export default function Piano({
  notes,
  labels,
  activeNoteIds,
  sustainedNoteIds,
  onNoteOn,
  onNoteOff,
  split,
}: PianoProps) {
  const railRef = useRef<HTMLDivElement>(null);

  /** White keys in order, and each black key with the count of white keys before it */
  const { whiteKeys, blackKeys, whiteBefore } = useMemo(() => {
    const whiteKeys: Note[] = [];
    const blackKeys: Array<{ note: Note; index: number; whiteKeysBefore: number }> = [];
    const whiteBefore: number[] = [];
    notes.forEach((note, index) => {
      whiteBefore.push(whiteKeys.length);
      if (note.isBlack) blackKeys.push({ note, index, whiteKeysBefore: whiteKeys.length });
      else whiteKeys.push(note);
    });
    return { whiteKeys, blackKeys, whiteBefore };
  }, [notes]);

  // On narrow screens the keyboard scrolls: start in the middle
  useEffect(() => {
    const rail = railRef.current;
    if (rail && rail.scrollWidth > rail.clientWidth) {
      rail.scrollLeft = (rail.scrollWidth - rail.clientWidth) / 2;
    }
  }, []);

  const sizeVariables = {
    '--white-key-width': `clamp(${MIN_WHITE_KEY_WIDTH}px, calc((min(100vw, ${MAX_LAYOUT_WIDTH}) - ${HORIZONTAL_CHROME}) / ${whiteKeys.length}), ${WHITE_KEY_WIDTH}px)`,
    '--white-key-height': `clamp(${MIN_WHITE_KEY_HEIGHT}px, calc(var(--white-key-width) * 3.85), ${WHITE_KEY_HEIGHT}px)`,
    '--black-key-width': `calc(var(--white-key-width) * ${BLACK_KEY_WIDTH_RATIO})`,
    '--black-key-height': `calc(var(--white-key-height) * ${BLACK_KEY_HEIGHT_RATIO})`,
  } as CSSProperties;

  const labelFor = (note: Note) => labels?.get(note.code) ?? note.keyLabel;

  /** Horizontal position of the split, at the left edge of the first right-hand key */
  const splitLeft = (() => {
    if (!split) return null;
    const note = notes[split.index];
    if (!note) return null;
    const base = `var(--white-key-width) * ${whiteBefore[split.index]}`;
    return note.isBlack ? `calc(${base} - var(--black-key-width) / 2)` : `calc(${base})`;
  })();

  return (
    <div ref={railRef} className="scroll-rail w-full overflow-x-auto">
      <div className="mx-auto flex w-max items-stretch" style={sizeVariables}>
        <Cheek side="left" />

        <div className="flex flex-col">
          {/* Fallboard: the lacquered strip above the keys, with the wordmark */}
          <div className="relative flex h-11 items-center justify-center bg-linear-to-b from-[#211d27] via-[#141117] to-[#0c0a0e] shadow-[inset_0_1px_0_rgb(255_255_255/0.07)]">
            <span
              className="select-none bg-linear-to-b from-[var(--brass-light)] via-[var(--brass)] to-[#8f6f35] bg-clip-text text-lg font-semibold tracking-[0.12em] text-transparent [font-stretch:88%]"
              aria-hidden="true"
            >
              Keyboard Piano
            </span>
            <span className="absolute right-4 hidden rounded-sm border border-[rgb(201_161_90/0.45)] px-1.5 py-px text-[10px] font-medium tracking-[0.08em] text-brass sm:block">
              KP-37
            </span>

            {split && splitLeft && (
              <>
                <span className="absolute bottom-1.5 left-3 text-[11px] text-led/90">◂ {split.leftLabel}</span>
                <span className="absolute bottom-1.5 right-3 text-[11px] text-led/90 sm:right-20">{split.rightLabel} ▸</span>
              </>
            )}
          </div>

          {/* Red key felt */}
          <div className="h-1.5 bg-linear-to-b from-[#9b2530] to-felt" />

          <div className="relative flex bg-[#0c0a0e]" role="group" aria-label="Piano keyboard">
            {whiteKeys.map((note) => (
              <PianoKey
                // Keyed by physical key so keys stay mounted across octave shifts
                key={note.code}
                note={note}
                label={labelFor(note)}
                index={notes.indexOf(note)}
                isActive={activeNoteIds.has(note.id)}
                isSustained={sustainedNoteIds?.has(note.id) ?? false}
                onNoteOn={onNoteOn}
                onNoteOff={onNoteOff}
              />
            ))}

            {blackKeys.map(({ note, index, whiteKeysBefore }) => (
              <div
                key={note.code}
                className="absolute top-0 z-10"
                style={{ left: `calc(var(--white-key-width) * ${whiteKeysBefore})` }}
              >
                <PianoKey
                  note={note}
                  label={labelFor(note)}
                  index={index}
                  isActive={activeNoteIds.has(note.id)}
                  isSustained={sustainedNoteIds?.has(note.id) ?? false}
                  onNoteOn={onNoteOn}
                  onNoteOff={onNoteOff}
                />
              </div>
            ))}

            {splitLeft && (
              // Split marker: an amber line dropping from the felt into the keys
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -top-1.5 z-20 h-6 w-[3px] -translate-x-1/2 rounded-b-full bg-led shadow-[0_0_10px_var(--led)]"
                style={{ left: splitLeft }}
              />
            )}
          </div>
        </div>

        <Cheek side="right" />
      </div>
    </div>
  );
}

/** Walnut end block that frames the keys */
function Cheek({ side }: { side: 'left' | 'right' }) {
  return (
    <div
      aria-hidden="true"
      className={`w-5 shrink-0 sm:w-7 ${side === 'left' ? 'rounded-l-[10px]' : 'rounded-r-[10px]'}`}
      style={{
        background:
          'repeating-linear-gradient(178deg, rgb(0 0 0 / 0.12) 0 2px, transparent 2px 7px), linear-gradient(180deg, #6b4130 0%, var(--walnut) 45%, var(--walnut-dark) 100%)',
        boxShadow:
          side === 'left'
            ? 'inset 1px 1px 0 rgb(255 255 255 / 0.12), inset -2px 0 3px rgb(0 0 0 / 0.4)'
            : 'inset -1px 1px 0 rgb(255 255 255 / 0.08), inset 2px 0 3px rgb(0 0 0 / 0.4)',
      }}
    />
  );
}
