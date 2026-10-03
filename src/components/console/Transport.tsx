/**
 * @fileoverview Recorder transport: record, play, stop.
 *
 * Round buttons like a tape deck. The record LED blinks red while
 * recording; play and stop light amber when relevant.
 */

'use client';

import { RecorderStatus } from '@/types';
import Led from '../ui/Led';
import PadButton from '../ui/PadButton';
import { formatTime } from './Display';

interface TransportProps {
  status: RecorderStatus;
  duration: number;
  hasRecording: boolean;
  onRecord: () => void;
  onPlay: () => void;
  onStop: () => void;
  onClear: () => void;
}

export default function Transport({
  status,
  duration,
  hasRecording,
  onRecord,
  onPlay,
  onStop,
  onClear,
}: TransportProps) {
  const statusText =
    status === 'recording'
      ? 'Recording. Play something.'
      : status === 'playing'
        ? 'Playing your take'
        : hasRecording
          ? `Take ready, ${formatTime(duration)}`
          : 'Press record, then play';

  return (
    <div role="group" aria-label="Recorder" className="flex flex-col gap-3">
      <span className="text-sm text-ink-muted">Recorder</span>
      <div className="flex items-center gap-2.5">
        <PadButton
          aria-label="Record"
          aria-pressed={status === 'recording'}
          active={status === 'recording'}
          onClick={onRecord}
          className="flex h-11 w-11 items-center justify-center rounded-full!"
        >
          <span
            className={`block h-3.5 w-3.5 rounded-full ${status === 'recording' ? 'led-blink' : ''}`}
            style={{
              backgroundColor: 'var(--rec)',
              boxShadow: status === 'recording' ? '0 0 10px var(--rec)' : 'none',
            }}
          />
        </PadButton>
        <PadButton
          aria-label="Play recording"
          aria-pressed={status === 'playing'}
          active={status === 'playing'}
          disabled={!hasRecording || status === 'recording'}
          onClick={onPlay}
          className="flex h-11 w-11 items-center justify-center rounded-full!"
        >
          <svg viewBox="0 0 12 12" className="ml-0.5 h-3.5 w-3.5" aria-hidden="true">
            <path d="M2 1.5v9l8-4.5z" fill={status === 'playing' ? 'var(--led)' : 'var(--ink)'} />
          </svg>
        </PadButton>
        <PadButton
          aria-label="Stop"
          disabled={status === 'idle'}
          onClick={onStop}
          className="flex h-11 w-11 items-center justify-center rounded-full!"
        >
          <span className="block h-3 w-3 rounded-[2px] bg-ink" />
        </PadButton>
      </div>
      <div className="flex min-h-5 items-center gap-2 text-xs text-ink-muted">
        <Led on={status !== 'idle'} tone={status === 'recording' ? 'red' : 'amber'} />
        <span aria-live="polite">{statusText}</span>
        {hasRecording && status === 'idle' && (
          <button
            type="button"
            onClick={onClear}
            className="ml-auto rounded text-ink-faint underline-offset-2 hover:text-ink hover:underline"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
