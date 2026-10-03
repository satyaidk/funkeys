/**
 * @fileoverview Notes: loop a famous riff and play along with it.
 *
 * Pick a song, press Play, and its riff repeats on the keyboard (keys light
 * up as they play) until you press Stop. Choosing another song while one is
 * playing switches straight to it; the speed control slows a riff down to
 * learn it.
 */

'use client';

import { Riff } from '@/lib/music/riffs';
import { LOOP_SPEEDS } from '@/lib/constants';
import RadioPads, { PadOption } from '../../ui/RadioPads';
import SegmentedControl, { SegmentOption } from '../../ui/SegmentedControl';
import PadButton from '../../ui/PadButton';
import Led from '../../ui/Led';

interface NotesPanelProps {
  riffs: readonly Riff[];
  riffId: string;
  speed: number;
  playing: boolean;
  onToggle: () => void;
  onSelect: (riffId: string) => void;
  onSpeedChange: (speed: number) => void;
}

const SPEED_OPTIONS: readonly SegmentOption<string>[] = LOOP_SPEEDS.map((s) => ({
  value: String(s),
  label: `${s * 100}%`,
}));

export default function NotesPanel({
  riffs,
  riffId,
  speed,
  playing,
  onToggle,
  onSelect,
  onSpeedChange,
}: NotesPanelProps) {
  const riff = riffs.find((r) => r.id === riffId) ?? riffs[0];
  const options: PadOption<string>[] = riffs.map((r) => ({ value: r.id, label: r.title, description: r.artist }));

  return (
    <div className="grid items-start gap-x-8 gap-y-6 xl:grid-cols-[auto_minmax(0,1fr)]">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4 xl:flex-col xl:items-start">
        <div className="flex items-center gap-4">
          {/* The label says what a press will do, so it isn't also marked aria-pressed */}
          <PadButton
            active={playing}
            onClick={onToggle}
            className="flex h-[4.5rem] w-32 items-center justify-center gap-2.5 text-base font-medium text-ink"
          >
            <Led on={playing} />
            {playing ? 'Stop loop' : 'Play loop'}
          </PadButton>
          <div className="text-sm">
            <p className="tabular-nums text-ink">{Math.round(riff.bpm * speed)} BPM</p>
            <p className="text-ink-muted">{riff.timeSignature} time</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm text-ink-muted">Speed</span>
          <SegmentedControl
            label="Speed"
            options={SPEED_OPTIONS}
            value={String(speed)}
            onChange={(value) => onSpeedChange(Number(value))}
          />
        </div>
      </div>

      <RadioPads label="Song" options={options} value={riff.id} onChange={onSelect} columns="grid-cols-2 md:grid-cols-4" />
    </div>
  );
}
