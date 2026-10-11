/**
 * @fileoverview Transport controls for songs and transcriptions: play/pause,
 * stop, a seek bar with the time, speed and loop.
 *
 * Shared by the Notes library and the Audio to Piano page. The position is
 * read every animation frame here (`usePlaybackPosition`), so only this
 * small component re-renders while the playhead moves.
 */

'use client';

import { PlaybackState } from '@/lib/audio/sequence-player';
import { PLAYBACK_SPEEDS } from '@/lib/constants';
import { formatSeconds } from '@/lib/format';
import { usePlaybackPosition } from '@/hooks/useSequencePlayer';
import PadButton from '../ui/PadButton';
import SegmentedControl, { SegmentOption } from '../ui/SegmentedControl';
import Led from '../ui/Led';

export interface PlaybackBarProps {
  /** Accessible name, e.g. "Song playback" */
  label: string;
  state: PlaybackState;
  duration: number;
  getPosition: () => number;
  /** Changes when the position jumps while not playing */
  revision: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (seconds: number) => void;
  rate: number;
  onRateChange: (rate: number) => void;
  loop?: boolean;
  onLoopChange?: (loop: boolean) => void;
  disabled?: boolean;
}

const SPEED_OPTIONS: readonly SegmentOption<string>[] = PLAYBACK_SPEEDS.map((s) => ({
  value: String(s),
  label: `${s * 100}%`,
}));

export function PlayIcon({ playing, className = 'h-4 w-4' }: { playing: boolean; className?: string }) {
  return playing ? (
    <svg viewBox="0 0 12 12" className={className} aria-hidden="true">
      <rect x="2" y="1.5" width="2.8" height="9" rx="0.6" fill="currentColor" />
      <rect x="7.2" y="1.5" width="2.8" height="9" rx="0.6" fill="currentColor" />
    </svg>
  ) : (
    <svg viewBox="0 0 12 12" className={`${className} translate-x-px`} aria-hidden="true">
      <path d="M2.5 1.5v9l8-4.5z" fill="currentColor" />
    </svg>
  );
}

export default function PlaybackBar({
  label,
  state,
  duration,
  getPosition,
  revision,
  onPlay,
  onPause,
  onStop,
  onSeek,
  rate,
  onRateChange,
  loop,
  onLoopChange,
  disabled = false,
}: PlaybackBarProps) {
  const position = Math.min(duration, usePlaybackPosition({ state, getPosition, revision }));
  const playing = state === 'playing';

  return (
    <div role="group" aria-label={label} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <PadButton
          aria-label={playing ? 'Pause' : state === 'paused' ? 'Resume' : 'Play'}
          active={playing}
          disabled={disabled}
          onClick={playing ? onPause : onPlay}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full! text-ink"
        >
          <PlayIcon playing={playing} />
        </PadButton>
        <PadButton
          aria-label="Stop"
          disabled={disabled || state === 'stopped'}
          onClick={onStop}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full!"
        >
          <span className="block h-3 w-3 rounded-[2px] bg-ink" />
        </PadButton>

        <span className="w-11 shrink-0 text-right text-xs tabular-nums text-ink" aria-hidden="true">
          {formatSeconds(position)}
        </span>
        <input
          type="range"
          aria-label="Seek"
          aria-valuetext={`${formatSeconds(position)} of ${formatSeconds(duration)}`}
          min={0}
          max={Math.max(duration, 0.01)}
          step={0.01}
          value={position}
          disabled={disabled || duration <= 0}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="min-w-0 flex-1 cursor-pointer accent-led disabled:cursor-default disabled:opacity-40"
        />
        <span className="w-11 shrink-0 text-xs tabular-nums text-ink-muted" aria-hidden="true">
          {formatSeconds(duration)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <SegmentedControl
          label="Playback speed"
          options={SPEED_OPTIONS}
          value={String(rate)}
          onChange={(value) => onRateChange(Number(value))}
          disabled={disabled}
        />
        {onLoopChange && (
          <PadButton
            aria-pressed={!!loop}
            active={!!loop}
            disabled={disabled}
            onClick={() => onLoopChange(!loop)}
            className="flex h-9 items-center gap-2 px-3 text-sm text-ink"
          >
            <Led on={!!loop} />
            Loop
          </PadButton>
        )}
      </div>
    </div>
  );
}
