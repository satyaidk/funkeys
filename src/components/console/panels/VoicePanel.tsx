/**
 * @fileoverview Voice selection: the eight instrument sounds.
 */

'use client';

import { VoiceId } from '@/types';
import { VOICES } from '@/lib/audio/voices';
import RadioPads, { PadOption } from '../../ui/RadioPads';

export const VOICE_OPTIONS: readonly PadOption<VoiceId>[] = VOICES.map((v) => ({
  value: v.id,
  label: v.name,
  description: v.description,
}));

interface VoicePanelProps {
  voice: VoiceId;
  onChange: (voice: VoiceId) => void;
}

export default function VoicePanel({ voice, onChange }: VoicePanelProps) {
  return (
    <RadioPads
      label="Voice"
      options={VOICE_OPTIONS}
      value={voice}
      onChange={onChange}
      columns="grid-cols-2 md:grid-cols-4"
    />
  );
}
