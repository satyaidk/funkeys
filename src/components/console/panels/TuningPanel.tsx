/**
 * @fileoverview Tuning: transpose, master tuning (A4), temperament and its key.
 *
 * Like on a Clavinova, the temperament's base note is chosen with −/+
 * buttons; it cycles through the 12 keys.
 */

'use client';

import { PianoSettings, TemperamentId } from '@/types';
import { TEMPERAMENTS } from '@/lib/music/tuning';
import { KEY_NAMES } from '@/lib/music/notes';
import {
  DEFAULT_REFERENCE_PITCH,
  MAX_REFERENCE_PITCH,
  MAX_TRANSPOSE,
  MIN_REFERENCE_PITCH,
  REFERENCE_PITCH_STEP,
} from '@/lib/constants';
import Stepper from '../../ui/Stepper';
import RadioPads, { PadOption } from '../../ui/RadioPads';
import Field from '../../ui/Field';

interface TuningPanelProps {
  settings: PianoSettings;
  onChange: (patch: Partial<PianoSettings>) => void;
}

const TEMPERAMENT_OPTIONS: readonly PadOption<TemperamentId>[] = TEMPERAMENTS.map((t) => ({
  value: t.id,
  label: t.name,
  description: t.description,
}));

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export default function TuningPanel({ settings, onChange }: TuningPanelProps) {
  const { transpose, referencePitch, temperament, temperamentRoot } = settings;
  const heard = KEY_NAMES[((transpose % 12) + 12) % 12];
  const isEqual = temperament === 'equal';
  const isDefaultPitch = referencePitch === DEFAULT_REFERENCE_PITCH;

  return (
    <div className="grid gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-[auto_auto_minmax(0,1fr)_auto]">
      <Field label="Transpose" hint={`Play C, hear ${heard}${Math.abs(transpose) >= 12 ? ' an octave away' : ''}.`}>
        <Stepper
          label="Transpose"
          valueText={signed(transpose)}
          onDecrement={() => onChange({ transpose: transpose - 1 })}
          onIncrement={() => onChange({ transpose: transpose + 1 })}
          canDecrement={transpose > -MAX_TRANSPOSE}
          canIncrement={transpose < MAX_TRANSPOSE}
          decrementLabel="Transpose down a semitone"
          incrementLabel="Transpose up a semitone"
        />
      </Field>

      <Field
        label="Master tuning (A4)"
        hint={
          isDefaultPitch ? (
            `${MIN_REFERENCE_PITCH} to ${MAX_REFERENCE_PITCH} Hz. Hold to sweep.`
          ) : (
            <button
              type="button"
              onClick={() => onChange({ referencePitch: DEFAULT_REFERENCE_PITCH })}
              className="text-led/90 underline underline-offset-2 hover:text-led"
            >
              Reset to 440 Hz
            </button>
          )
        }
      >
        <Stepper
          label="Master tuning"
          valueText={`${referencePitch.toFixed(1)} Hz`}
          onDecrement={() => onChange({ referencePitch: referencePitch - REFERENCE_PITCH_STEP })}
          onIncrement={() => onChange({ referencePitch: referencePitch + REFERENCE_PITCH_STEP })}
          canDecrement={referencePitch > MIN_REFERENCE_PITCH}
          canIncrement={referencePitch < MAX_REFERENCE_PITCH}
          decrementLabel="Tune down 0.1 Hz"
          incrementLabel="Tune up 0.1 Hz"
        />
      </Field>

      <Field label="Temperament" hint={TEMPERAMENTS.find((t) => t.id === temperament)?.description}>
        <RadioPads
          label="Temperament"
          options={TEMPERAMENT_OPTIONS}
          value={temperament}
          onChange={(id) => onChange({ temperament: id })}
          columns="grid-cols-2 sm:grid-cols-3"
          compact
        />
      </Field>

      <Field label="Temperament key" hint={isEqual ? 'Same in every key.' : 'Purest in this key.'}>
        <Stepper
          label="Temperament key"
          valueText={KEY_NAMES[temperamentRoot]}
          onDecrement={() => onChange({ temperamentRoot: temperamentRoot - 1 })}
          onIncrement={() => onChange({ temperamentRoot: temperamentRoot + 1 })}
          decrementLabel="Previous key"
          incrementLabel="Next key"
          disabled={isEqual}
        />
      </Field>
    </div>
  );
}
