/**
 * @fileoverview Edit the selected note: pitch, start, length, velocity.
 *
 * Every change goes through the editor (validated, undoable); the playing
 * transcription picks it up at once.
 */

'use client';

import { useState } from 'react';
import { PianoNoteEvent } from '@/types';
import { midiToNoteId } from '@/lib/music/notes';
import { NoteEdit } from '@/lib/music/note-events';
import { PIANO_HIGHEST_MIDI, PIANO_LOWEST_MIDI } from '@/lib/constants';
import Stepper from '../ui/Stepper';
import PadButton from '../ui/PadButton';
import Field from '../ui/Field';

interface NoteInspectorProps {
  note: PianoNoteEvent | null;
  onEdit: (edit: NoteEdit) => void;
  onDelete: () => void;
  onPreview: (note: PianoNoteEvent) => void;
}

/** A seconds field that only commits valid numbers, so typing "1." doesn't jump the note */
function SecondsInput({ label, value, min, onCommit }: { label: string; value: number; min: number; onCommit: (v: number) => void }) {
  const shown = value.toFixed(2);
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const v = Number(draft);
    if (Number.isFinite(v) && v >= min) onCommit(v);
    setDraft(null);
  };
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm text-ink-muted">
      {label}
      <input
        type="number"
        inputMode="decimal"
        step={0.01}
        min={min}
        value={draft ?? shown}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
        className="h-9 w-full rounded-md border border-white/[0.08] bg-panel-sunk px-2.5 tabular-nums text-ink shadow-[inset_0_1px_3px_rgb(0_0_0/0.5)] focus:border-[rgb(255_181_71/0.5)]"
      />
    </label>
  );
}

export default function NoteInspector({ note, onEdit, onDelete, onPreview }: NoteInspectorProps) {
  if (!note) {
    return (
      <div className="flex min-h-36 items-center justify-center rounded-lg border border-dashed border-white/10 p-4 text-center text-sm text-ink-faint">
        Select a note in the piano roll to change its pitch, timing or loudness.
      </div>
    );
  }

  const duration = note.endTime - note.startTime;
  return (
    <section aria-label="Selected note" className="flex flex-col gap-4 rounded-lg border border-white/[0.06] bg-panel-sunk/60 p-3.5">
      <Field label="Pitch">
        <div className="flex flex-wrap items-center gap-2">
          <Stepper
            label="Pitch"
            valueText={`${midiToNoteId(note.midi)}`}
            onDecrement={() => onEdit({ midi: note.midi - 1 })}
            onIncrement={() => onEdit({ midi: note.midi + 1 })}
            canDecrement={note.midi > PIANO_LOWEST_MIDI}
            canIncrement={note.midi < PIANO_HIGHEST_MIDI}
            decrementLabel="Down a semitone"
            incrementLabel="Up a semitone"
            valueClassName="min-w-[4.5rem]!"
          />
          <PadButton
            aria-label="Down an octave"
            disabled={note.midi - 12 < PIANO_LOWEST_MIDI}
            onClick={() => onEdit({ midi: note.midi - 12 })}
            className="h-9 px-2.5 text-xs text-ink"
          >
            −8va
          </PadButton>
          <PadButton
            aria-label="Up an octave"
            disabled={note.midi + 12 > PIANO_HIGHEST_MIDI}
            onClick={() => onEdit({ midi: note.midi + 12 })}
            className="h-9 px-2.5 text-xs text-ink"
          >
            +8va
          </PadButton>
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        {/* Keyed by note so switching notes resets any half-typed value */}
        <SecondsInput key={`${note.id}-start`} label="Start (s)" value={note.startTime} min={0} onCommit={(v) => onEdit({ startTime: v })} />
        <SecondsInput key={`${note.id}-length`} label="Length (s)" value={duration} min={0.02} onCommit={(v) => onEdit({ duration: v })} />
      </div>

      <label className="flex flex-col gap-1.5 text-sm text-ink-muted">
        <span className="flex justify-between">
          Velocity <span className="tabular-nums text-ink">{Math.round(note.velocity * 100)}%</span>
        </span>
        <input
          type="range"
          min={0.05}
          max={1}
          step={0.01}
          value={note.velocity}
          onChange={(e) => onEdit({ velocity: Number(e.target.value) })}
          className="w-full cursor-pointer accent-led"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <PadButton onClick={() => onPreview(note)} className="h-9 px-3 text-sm text-ink">
          ▶ Preview note
        </PadButton>
        <PadButton onClick={onDelete} className="h-9 px-3 text-sm text-rec">
          Delete note
        </PadButton>
      </div>
    </section>
  );
}
