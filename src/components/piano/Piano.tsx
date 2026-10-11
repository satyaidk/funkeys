/**
 * @fileoverview The keyboard: a toolbar (octave, navigation), walnut
 * cheeks, a lacquered fallboard with the wordmark, a strip of red felt, and
 * 37 keys.
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
 * ## Pointer input (mouse, touch, pen)
 * The keyboard handles every pointer in one place instead of each key
 * listening for itself:
 *
 * - A pointer that goes down on a key is **captured**, so its moves and
 *   release reach the keyboard even if it wanders off
 * - As it moves, the key under it is found with `elementFromPoint`: sliding
 *   along the keys plays each one (a glissando), sliding off stops the note
 * - Each finger is tracked by its pointer id (`PointerTracker`), so chords
 *   work on multi-touch screens
 * - Release, cancel, losing focus or hiding the tab all stop the notes, so
 *   nothing is left stuck on
 * - `touch-action: none` on the keys (and only there) stops a touch from
 *   scrolling or zooming the page mid-melody; the rest of the page scrolls
 *   normally
 *
 * ## Size and navigation
 * Key sizes are CSS variables computed with clamp() from the viewport (ADR
 * 0004). Below the minimum key width the keys keep a playable size and
 * the keyboard becomes a window you move with the minimap (ADR 0015).
 */

'use client';

import { CSSProperties, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Note } from '@/types';
import {
  WHITE_KEY_WIDTH,
  MIN_WHITE_KEY_WIDTH,
  WHITE_KEY_HEIGHT,
  MIN_WHITE_KEY_HEIGHT,
  BLACK_KEY_WIDTH_RATIO,
  BLACK_KEY_HEIGHT_RATIO,
} from '@/lib/constants';
import { velocityFromPosition } from '@/lib/audio/dynamics';
import { PointerTracker } from '@/lib/pointer-tracker';
import PianoKey from './PianoKey';
import KeyboardMinimap, { KeyboardView } from './KeyboardMinimap';
import OctaveControls, { OctaveControlsProps } from './OctaveControls';

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
  /** Notes sounding from song or transcription playback (lit like held keys) */
  playbackNoteIds?: ReadonlySet<string>;
  onNoteOn: (noteId: string, velocity: number) => void;
  onNoteOff: (noteId: string) => void;
  split?: SplitMarker | null;
  /** Octave controls in the toolbar */
  octave?: OctaveControlsProps;
  /** Extra controls at the end of the toolbar */
  toolbarEnd?: ReactNode;
}

/** Space around the keys: page gutters, cabinet padding and both cheeks */
const HORIZONTAL_CHROME = '9rem';
const MAX_LAYOUT_WIDTH = '1480px';
/** How long a key sounds when "clicked" by a screen reader or switch device */
const ACTIVATION_MS = 400;

const EMPTY: ReadonlySet<string> = new Set();

/** The key element at (or containing) a DOM element, if it's one of ours */
function keyElementOf(target: EventTarget | null, container: HTMLElement | null): HTMLElement | null {
  if (!(target instanceof Element) || !container) return null;
  const key = target.closest<HTMLElement>('[data-note-id]');
  return key && container.contains(key) ? key : null;
}

/** Velocity from where on the key the pointer is: nearer the front edge plays louder */
function velocityAt(key: HTMLElement, clientY: number): number {
  const rect = key.getBoundingClientRect();
  return velocityFromPosition(rect.height > 0 ? (clientY - rect.top) / rect.height : 0.75);
}

export default function Piano({
  notes,
  labels,
  activeNoteIds,
  sustainedNoteIds = EMPTY,
  playbackNoteIds = EMPTY,
  onNoteOn,
  onNoteOff,
  split,
  octave,
  toolbarEnd,
}: PianoProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef<HTMLDivElement>(null);
  const [pointers] = useState(() => new PointerTracker());
  const [view, setView] = useState<KeyboardView & { overflow: boolean }>({ start: 0, end: 1, overflow: false });

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

  // ── Navigation: which part of the keyboard is visible ─────────────────
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const { scrollLeft, scrollWidth, clientWidth } = rail;
      const overflow = scrollWidth > clientWidth + 1;
      const start = overflow ? scrollLeft / scrollWidth : 0;
      const end = overflow ? (scrollLeft + clientWidth) / scrollWidth : 1;
      setView((v) =>
        v.overflow === overflow && Math.abs(v.start - start) < 0.002 && Math.abs(v.end - end) < 0.002
          ? v
          : { start, end, overflow }
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    // On narrow screens, start with the middle octave (the board's second C) at the left
    if (rail.scrollWidth > rail.clientWidth + 1) {
      const middleC = keysRef.current?.querySelectorAll<HTMLElement>('[data-note-id^="C"]:not([data-note-id^="C#"])')[1];
      if (middleC) {
        rail.scrollLeft = middleC.getBoundingClientRect().left - rail.getBoundingClientRect().left + rail.scrollLeft - 4;
      }
    }
    measure();

    rail.addEventListener('scroll', schedule, { passive: true });
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    observer?.observe(rail);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      rail.removeEventListener('scroll', schedule);
      observer?.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, []);

  const scrollTo = useCallback((center: number) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollLeft = center * rail.scrollWidth - rail.clientWidth / 2;
  }, []);

  const step = useCallback((direction: -1 | 1) => {
    const rail = railRef.current;
    const whiteKey = keysRef.current?.querySelector<HTMLElement>('[data-note-id]:not([data-note-id*="#"])');
    if (!rail || !whiteKey) return;
    rail.scrollBy({ left: direction * whiteKey.offsetWidth * 7, behavior: 'smooth' });
  }, []);

  // ── Pointer input ──────────────────────────────────────────────────────
  const apply = useCallback(
    (change: { start: string | null; stop: string | null }, velocity: number) => {
      if (change.stop) onNoteOff(change.stop);
      if (change.start) onNoteOn(change.start, velocity);
    },
    [onNoteOn, onNoteOff]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // right-click opens a menu that swallows pointerup
    const key = keyElementOf(e.target, keysRef.current);
    if (!key) return;
    e.preventDefault(); // no focus, no text selection, no emulated mouse events after touch
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* unsupported: release still arrives while the pointer is over the keys */
    }
    apply(pointers.move(e.pointerId, key.dataset.noteId!), velocityAt(key, e.clientY));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.has(e.pointerId) || typeof document.elementFromPoint !== 'function') return;
    // With pointer capture the event target is the keyboard, so look up what's under the pointer
    const key = keyElementOf(document.elementFromPoint(e.clientX, e.clientY), keysRef.current);
    apply(pointers.move(e.pointerId, key?.dataset.noteId ?? null), key ? velocityAt(key, e.clientY) : 0);
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const stop = pointers.release(e.pointerId);
    if (stop) onNoteOff(stop);
  };

  // Pointers held while the window loses focus or the tab is hidden never send pointerup
  useEffect(() => {
    const releaseAll = () => pointers.releaseAll().forEach((noteId) => onNoteOff(noteId));
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') releaseAll();
    };
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', releaseAll);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [pointers, onNoteOff]);

  // Screen readers and switch devices "click" a key without pointer events: play a short note
  const activationTimers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const timers = activationTimers.current;
    return () => timers.forEach(clearTimeout);
  }, []);
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.detail !== 0) return; // a real click: the pointer handlers already played it
    const noteId = keyElementOf(e.target, keysRef.current)?.dataset.noteId;
    if (!noteId) return;
    onNoteOn(noteId, 0.75);
    const timer = setTimeout(() => {
      activationTimers.current.delete(timer);
      onNoteOff(noteId);
    }, ACTIVATION_MS);
    activationTimers.current.add(timer);
  };

  // ── Layout ─────────────────────────────────────────────────────────────
  const sizeVariables = {
    '--white-key-width': `clamp(${MIN_WHITE_KEY_WIDTH}px, calc((min(100vw, ${MAX_LAYOUT_WIDTH}) - ${HORIZONTAL_CHROME}) / ${whiteKeys.length}), ${WHITE_KEY_WIDTH}px)`,
    // Tall enough to play, but never more than about half a landscape phone's height
    '--white-key-height': `clamp(${MIN_WHITE_KEY_HEIGHT}px, min(calc(var(--white-key-width) * 4.2), 52dvh), ${WHITE_KEY_HEIGHT}px)`,
    '--black-key-width': `calc(var(--white-key-width) * ${BLACK_KEY_WIDTH_RATIO})`,
    '--black-key-height': `calc(var(--white-key-height) * ${BLACK_KEY_HEIGHT_RATIO})`,
  } as CSSProperties;

  const labelFor = (note: Note) => labels?.get(note.code) ?? note.keyLabel;
  const isLit = (id: string) => activeNoteIds.has(id) || playbackNoteIds.has(id);

  const litNoteIds = useMemo(
    () => new Set([...activeNoteIds, ...sustainedNoteIds, ...playbackNoteIds]),
    [activeNoteIds, sustainedNoteIds, playbackNoteIds]
  );

  /** Horizontal position of the split, at the left edge of the first right-hand key */
  const splitLeft = (() => {
    if (!split) return null;
    const note = notes[split.index];
    if (!note) return null;
    const base = `var(--white-key-width) * ${whiteBefore[split.index]}`;
    return note.isBlack ? `calc(${base} - var(--black-key-width) / 2)` : `calc(${base})`;
  })();

  return (
    <div className="flex flex-col gap-2.5">
      {(octave || toolbarEnd || view.overflow) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-2 sm:px-3">
          {octave && <OctaveControls {...octave} />}
          {view.overflow ? (
            <KeyboardMinimap notes={notes} view={view} litNoteIds={litNoteIds} onScrollTo={scrollTo} onStep={step} />
          ) : (
            <div className="hidden flex-1 sm:block" />
          )}
          {toolbarEnd && <div className="flex shrink-0 items-center gap-2">{toolbarEnd}</div>}
        </div>
      )}

      <div ref={railRef} className="scroll-rail w-full overflow-x-auto overscroll-x-contain">
        <div className="mx-auto flex w-max items-stretch" style={sizeVariables}>
          <Cheek side="left" />

          <div className="flex flex-col">
            {/* Fallboard: the lacquered strip above the keys, with the wordmark */}
            <div className="relative hidden h-11 items-center justify-center bg-linear-to-b from-[#211d27] via-[#141117] to-[#0c0a0e] shadow-[inset_0_1px_0_rgb(255_255_255/0.07)] sm:flex">
              <span
                className="select-none bg-linear-to-b from-[var(--brass-light)] via-[var(--brass)] to-[#8f6f35] bg-clip-text text-lg font-semibold tracking-[0.12em] text-transparent [font-stretch:88%]"
                aria-hidden="true"
              >
                FunKeys
              </span>
              <span className="absolute right-4 hidden rounded-sm border border-[rgb(201_161_90/0.45)] px-1.5 py-px text-[10px] font-medium tracking-[0.08em] text-brass sm:block">
                FK-37
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

            <div
              ref={keysRef}
              className="relative flex touch-none select-none bg-[#0c0a0e] [-webkit-touch-callout:none]"
              role="group"
              aria-label="Piano keyboard"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              onLostPointerCapture={handlePointerEnd}
              onClick={handleClick}
              onContextMenu={(e) => e.preventDefault()} // long-press menu on phones
            >
              {whiteKeys.map((note) => (
                <PianoKey
                  // Keyed by physical key so keys stay mounted across octave shifts
                  key={note.code}
                  note={note}
                  label={labelFor(note)}
                  index={notes.indexOf(note)}
                  isActive={isLit(note.id)}
                  isSustained={sustainedNoteIds.has(note.id)}
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
                    isActive={isLit(note.id)}
                    isSustained={sustainedNoteIds.has(note.id)}
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
    </div>
  );
}

/** Walnut end block that frames the keys */
function Cheek({ side }: { side: 'left' | 'right' }) {
  return (
    <div
      aria-hidden="true"
      className={`w-3 shrink-0 sm:w-7 ${side === 'left' ? 'rounded-l-[10px]' : 'rounded-r-[10px]'}`}
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
