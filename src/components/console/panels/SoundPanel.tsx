/**
 * @fileoverview Sound settings: reverb room and depth, brilliance, touch.
 */

'use client';

import { PianoSettings } from '@/types';
import { BRILLIANCE_OPTIONS, REVERB_OPTIONS } from '@/lib/audio/effects';
import { TOUCH_CURVES } from '@/lib/audio/dynamics';
import SegmentedControl from '../../ui/SegmentedControl';
import Knob from '../../ui/Knob';
import Field from '../../ui/Field';

interface SoundPanelProps {
  settings: PianoSettings;
  onChange: (patch: Partial<PianoSettings>) => void;
}

const toOptions = <T extends string>(list: readonly { id: T; name: string }[]) =>
  list.map((o) => ({ value: o.id, label: o.name }));

const REVERB = toOptions(REVERB_OPTIONS);
const BRILLIANCE = toOptions(BRILLIANCE_OPTIONS);
const TOUCH = toOptions(TOUCH_CURVES);

const percent = (v: number) => `${Math.round(v * 100)}%`;

export default function SoundPanel({ settings, onChange }: SoundPanelProps) {
  const touch = TOUCH_CURVES.find((t) => t.id === settings.touch);

  return (
    <div className="grid gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_auto_minmax(0,1fr)_minmax(0,1.3fr)]">
      <Field label="Reverb" hint="The room you're playing in.">
        <SegmentedControl
          label="Reverb"
          options={REVERB}
          value={settings.reverb}
          onChange={(reverb) => onChange({ reverb })}
        />
      </Field>

      <Field label="Depth" hint={settings.reverb === 'off' ? 'Reverb is off' : percent(settings.reverbLevel)}>
        <Knob
          label="Reverb depth"
          value={settings.reverbLevel}
          min={0}
          max={1}
          step={0.01}
          size={60}
          onChange={(reverbLevel) => onChange({ reverbLevel })}
          format={percent}
        />
      </Field>

      <Field label="Brilliance" hint="Darker or brighter tone.">
        <SegmentedControl
          label="Brilliance"
          options={BRILLIANCE}
          value={settings.brilliance}
          onChange={(brilliance) => onChange({ brilliance })}
        />
      </Field>

      <Field label="Touch" hint={`${touch?.description}. Applies to mouse and touch, and sets keyboard loudness.`}>
        <SegmentedControl
          label="Touch sensitivity"
          options={TOUCH}
          value={settings.touch}
          onChange={(touch) => onChange({ touch })}
        />
      </Field>
    </div>
  );
}
