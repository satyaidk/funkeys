/**
 * @fileoverview A small piano-roll picture of a piece, with a playhead.
 *
 * Time runs left to right and pitch bottom to top; each note is a bar in
 * its rainbow color. Shows the shape of a song at a glance and how far
 * playback has got. Decorative: the transport next to it is the control.
 */

'use client';

import { useMemo } from 'react';
import { PianoNoteEvent } from '@/types';
import { getNoteColor, getNoteName } from '@/lib/music/notes';
import { pitchRange } from '@/lib/music/note-events';
import { PlaybackState } from '@/lib/audio/sequence-player';
import { usePlaybackPosition } from '@/hooks/useSequencePlayer';

interface NotePreviewProps {
  notes: readonly PianoNoteEvent[];
  duration: number;
  /** Playhead, when this piece is the one loaded */
  playback?: { state: PlaybackState; getPosition: () => number; revision: number } | null;
  className?: string;
}

const NO_PLAYBACK = { state: 'stopped' as const, getPosition: () => 0, revision: 0 };

export default function NotePreview({ notes, duration, playback, className = '' }: NotePreviewProps) {
  const range = useMemo(() => pitchRange(notes) ?? { low: 60, high: 72 }, [notes]);
  const rows = Math.max(12, range.high - range.low + 3);
  const low = range.low - 1;
  const length = Math.max(duration, 0.01);

  return (
    <div className={`relative h-14 overflow-hidden rounded-md bg-[#0c0a0e] shadow-[inset_0_1px_3px_rgb(0_0_0/0.8)] ${className}`}>
      <svg viewBox={`0 0 ${length} ${rows}`} preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">
        {notes.map((n) => (
          <rect
            key={n.id}
            x={n.startTime}
            y={rows - (n.midi - low) - 1}
            width={Math.max(n.endTime - n.startTime, length / 400)}
            height={0.8}
            fill={getNoteColor(getNoteName(n.midi))}
            opacity={0.55 + 0.45 * n.velocity}
          />
        ))}
      </svg>
      <Playhead playback={playback ?? NO_PLAYBACK} duration={length} />
    </div>
  );
}

function Playhead({ playback, duration }: { playback: NonNullable<NotePreviewProps['playback']>; duration: number }) {
  const position = usePlaybackPosition(playback);
  if (playback.state === 'stopped' && position === 0) return null;
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 w-px bg-led shadow-[0_0_6px_var(--led)]"
      style={{ left: `${Math.min(100, (position / duration) * 100)}%` }}
    />
  );
}
