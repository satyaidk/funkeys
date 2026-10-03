/**
 * @fileoverview Keyboard mode: one voice, two stacked voices, or a split keyboard.
 *
 * - **Layer** (called "Dual" on many digital pianos): every key plays two
 *   voices; the balance knob mixes them
 * - **Split**: keys left of the split point play a second voice, so the left
 *   hand can play bass or chords in a different sound
 */

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { KeyboardMode, Note, PianoSettings } from '@/types';
import { getVoice } from '@/lib/audio/voices';
import SegmentedControl from '../../ui/SegmentedControl';
import RadioPads from '../../ui/RadioPads';
import Knob from '../../ui/Knob';
import Stepper from '../../ui/Stepper';
import Field from '../../ui/Field';
import { VOICE_OPTIONS } from './VoicePanel';

interface LayerSplitPanelProps {
  settings: PianoSettings;
  notes: Note[];
  onChange: (patch: Partial<PianoSettings>) => void;
}

const MODE_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'layer', label: 'Layer' },
  { value: 'split', label: 'Split' },
] as const;

const MODE_HINTS: Record<KeyboardMode, string> = {
  single: 'One voice across the whole keyboard.',
  layer: 'Every key plays two voices at once.',
  split: 'Your left hand gets its own voice.',
};

/** "Main 100% / Layer 50%" from a 0–1 balance */
export function balanceText(balance: number): string {
  const main = Math.round(Math.min(1, 2 * (1 - balance)) * 100);
  const layer = Math.round(Math.min(1, 2 * balance) * 100);
  return `Main ${main}% / Layer ${layer}%`;
}

const swap = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.16 },
};

export default function LayerSplitPanel({ settings, notes, onChange }: LayerSplitPanelProps) {
  const splitNote = notes[settings.splitIndex]?.id ?? '';

  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <Field label="Mode" hint={MODE_HINTS[settings.mode]}>
        <SegmentedControl
          label="Keyboard mode"
          options={MODE_OPTIONS}
          value={settings.mode}
          onChange={(mode) => onChange({ mode })}
        />
      </Field>

      <AnimatePresence mode="wait" initial={false}>
        {settings.mode === 'single' && (
          <motion.p key="single" {...swap} className="self-center text-sm leading-relaxed text-ink-muted">
            Try <span className="text-ink">Layer</span> with Concert grand and String ensemble for a film-score
            sound, or <span className="text-ink">Split</span> to play a bass line on the bottom two rows.
          </motion.p>
        )}

        {settings.mode === 'layer' && (
          <motion.div key="layer" {...swap} className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
            <Field label="Layer voice">
              <RadioPads
                label="Layer voice"
                options={VOICE_OPTIONS}
                value={settings.layerVoice}
                onChange={(layerVoice) => onChange({ layerVoice })}
                columns="grid-cols-2 sm:grid-cols-4"
                compact
              />
            </Field>
            <Field label="Balance" hint={balanceText(settings.layerBalance)} className="items-start md:w-44">
              <Knob
                label="Layer balance"
                value={settings.layerBalance}
                min={0}
                max={1}
                step={0.05}
                onChange={(layerBalance) => onChange({ layerBalance })}
                format={balanceText}
              />
            </Field>
          </motion.div>
        )}

        {settings.mode === 'split' && (
          <motion.div key="split" {...swap} className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
            <Field label="Left-hand voice">
              <RadioPads
                label="Left-hand voice"
                options={VOICE_OPTIONS}
                value={settings.splitVoice}
                onChange={(splitVoice) => onChange({ splitVoice })}
                columns="grid-cols-2 sm:grid-cols-4"
                compact
              />
            </Field>
            <Field
              label="Split point"
              hint={`Keys below ${splitNote} play ${getVoice(settings.splitVoice).name}.`}
              className="md:w-56"
            >
              <Stepper
                label="Split point"
                valueText={splitNote}
                onDecrement={() => onChange({ splitIndex: settings.splitIndex - 1 })}
                onIncrement={() => onChange({ splitIndex: settings.splitIndex + 1 })}
                canDecrement={settings.splitIndex > 1}
                canIncrement={settings.splitIndex < notes.length - 1}
                decrementLabel="Move split point down"
                incrementLabel="Move split point up"
              />
            </Field>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
