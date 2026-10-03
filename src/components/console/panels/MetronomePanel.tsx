/**
 * @fileoverview Metronome: start/stop, tempo, time signature, tap tempo, volume.
 */

'use client';

import { motion } from 'framer-motion';
import { TIME_SIGNATURES, tempoMarking } from '@/lib/audio/metronome';
import { MAX_BPM, MIN_BPM } from '@/lib/constants';
import SegmentedControl from '../../ui/SegmentedControl';
import Stepper from '../../ui/Stepper';
import Knob from '../../ui/Knob';
import Led from '../../ui/Led';
import PadButton from '../../ui/PadButton';
import Field from '../../ui/Field';

interface MetronomePanelProps {
  running: boolean;
  bpm: number;
  timeSignature: string;
  beatsPerBar: number;
  accents: readonly number[];
  beat: number | null;
  volume: number;
  onToggle: () => void;
  onBpmChange: (bpm: number) => void;
  onTimeSignatureChange: (id: string) => void;
  onVolumeChange: (volume: number) => void;
  onTap: () => void;
}

const SIGNATURE_OPTIONS = TIME_SIGNATURES.map((t) => ({ value: t.id, label: t.id }));

export default function MetronomePanel({
  running,
  bpm,
  timeSignature,
  beatsPerBar,
  accents,
  beat,
  volume,
  onToggle,
  onBpmChange,
  onTimeSignatureChange,
  onVolumeChange,
  onTap,
}: MetronomePanelProps) {
  return (
    <div className="grid items-start gap-x-8 gap-y-6 sm:grid-cols-[auto_minmax(0,1fr)] xl:grid-cols-[auto_minmax(0,1.4fr)_auto_auto_auto]">
      <div className="flex flex-col gap-3">
        <PadButton
          active={running}
          aria-pressed={running}
          onClick={onToggle}
          className="flex h-[4.5rem] w-32 items-center justify-center gap-2.5 text-base font-medium text-ink"
        >
          <Led on={running} />
          {running ? 'Stop' : 'Start'}
        </PadButton>
        {/* Beat lights: the accented beat is bigger */}
        <div className="flex h-4 items-center gap-2" aria-hidden="true">
          {Array.from({ length: beatsPerBar }, (_, i) => (
            <motion.span
              key={`${timeSignature}-${i}`}
              className="rounded-full"
              style={{
                width: accents.includes(i) ? 12 : 8,
                height: accents.includes(i) ? 12 : 8,
              }}
              animate={{
                backgroundColor: beat === i ? 'var(--led)' : 'rgb(255 255 255 / 0.1)',
                boxShadow: beat === i ? '0 0 10px var(--led)' : '0 0 0 rgb(0 0 0 / 0)',
              }}
              transition={{ duration: 0.05 }}
            />
          ))}
        </div>
      </div>

      <Field label="Tempo" hint={tempoMarking(bpm)}>
        <div className="flex flex-col gap-3">
          <Stepper
            label="Tempo"
            valueText={`${bpm} BPM`}
            onDecrement={() => onBpmChange(bpm - 1)}
            onIncrement={() => onBpmChange(bpm + 1)}
            canDecrement={bpm > MIN_BPM}
            canIncrement={bpm < MAX_BPM}
            decrementLabel="Slower"
            incrementLabel="Faster"
          />
          <input
            type="range"
            aria-label="Tempo slider"
            min={MIN_BPM}
            max={MAX_BPM}
            value={bpm}
            onChange={(e) => onBpmChange(Number(e.target.value))}
            className="w-full max-w-xs cursor-pointer accent-led"
          />
        </div>
      </Field>

      <Field label="Time signature">
        <SegmentedControl
          label="Time signature"
          options={SIGNATURE_OPTIONS}
          value={timeSignature}
          onChange={onTimeSignatureChange}
        />
      </Field>

      <Field label="Tap tempo" hint="Tap along to set the beat.">
        <PadButton onClick={onTap} className="h-9 w-24 text-sm text-ink">
          Tap
        </PadButton>
      </Field>

      <Field label="Click volume">
        <Knob
          label="Metronome volume"
          value={volume}
          min={0}
          max={1}
          step={0.05}
          size={56}
          onChange={onVolumeChange}
          format={(v) => `${Math.round(v * 100)}%`}
        />
      </Field>
    </div>
  );
}
