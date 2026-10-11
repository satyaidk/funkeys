/**
 * @fileoverview Audio to Piano: turn a piano recording into notes that
 * FunKeys plays on its own keyboard.
 *
 * 1. Choose (or drop) a recording; it's checked for type, size and length
 * 2. The model listens in the background; progress shows each stage
 * 3. The notes appear in a piano roll; fix any the model got wrong
 * 4. Play them through the piano, keys lighting up, across the whole
 *    length of the recording; export them as MIDI or FunKeys notes
 *
 * The recording is the *input* only: what you hear is the FunKeys piano
 * playing the detected notes, never the original audio.
 */

'use client';

import { useMemo, useRef, useState } from 'react';
import { PianoNoteEvent } from '@/types';
import { TranscriptionControls } from '@/hooks/useTranscription';
import { SequencePlayerControls } from '@/hooks/useSequencePlayer';
import { acceptAttribute, browserSupport, MAX_DURATION_SECONDS, MAX_FILE_BYTES, supportedFormats } from '@/lib/transcription/audio-file';
import { STAGE_LABELS } from '@/lib/transcription/transcriber';
import { TranscriptionSettings } from '@/lib/transcription/notes-from-frames';
import { writeMidiFile } from '@/lib/music/midi-file';
import { serializeNotes } from '@/lib/transcription/notes-file';
import { pitchRange } from '@/lib/music/note-events';
import { keyboardRange, keyboardRangeLabel } from '@/lib/music/keyboard-map';
import { midiToNoteId } from '@/lib/music/notes';
import { downloadFile, fileStem } from '@/lib/download';
import { formatBytes, formatSeconds } from '@/lib/format';
import PlaybackBar from '../playback/PlaybackBar';
import PadButton from '../ui/PadButton';
import Led from '../ui/Led';
import PianoRoll from './PianoRoll';
import NoteInspector from './NoteInspector';

interface AudioPanelProps {
  transcription: TranscriptionControls;
  player: SequencePlayerControls;
  /** The keyboard's octave shift, to point out notes it can't show */
  octaveShift: number;
  /** Sound one note now (the inspector's preview) */
  onPreview: (note: PianoNoteEvent) => void;
}

export default function AudioPanel({ transcription: t, player, octaveShift, onPreview }: AudioPanelProps) {
  return (
    <div className="flex flex-col gap-5">
      {t.status === 'ready' ? (
        <Editor t={t} player={player} octaveShift={octaveShift} onPreview={onPreview} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="flex flex-col gap-4">
            {t.status === 'working' ? <Working t={t} /> : <DropZone onFile={t.open} />}
            {t.status === 'error' && t.error && (
              <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[rgb(255_90_79/0.35)] bg-[rgb(255_90_79/0.08)] px-4 py-3 text-sm text-ink">
                <span>{t.error}</span>
                {t.canRetry && (
                  <PadButton onClick={t.retry} className="px-3 py-1.5 text-xs text-ink">
                    Try again
                  </PadButton>
                )}
              </div>
            )}
          </div>
          <Settings t={t} />
        </div>
      )}
    </div>
  );
}

// ── Choosing a file ────────────────────────────────────────────────────

function DropZone({ onFile }: { onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const formats = useMemo(() => supportedFormats(browserSupport()), []);
  const accept = `${acceptAttribute(formats)},.mid,.midi,audio/midi,.json,application/json`;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
      className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-5 py-8 text-center transition-colors sm:py-10 ${
        dragging ? 'border-led bg-[rgb(255_181_71/0.08)]' : 'border-white/10 bg-panel-sunk/50'
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-9 w-9 text-led" aria-hidden="true">
        <path d="M9 18V6l11-2v12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="6.5" cy="18" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="17.5" cy="16" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
      <div>
        <p className="text-base font-medium text-ink">Turn a piano recording into notes</p>
        <p className="mt-1 text-sm text-ink-muted">FunKeys listens, writes out the notes, then plays them on its own piano.</p>
      </div>
      <PadButton onClick={() => inputRef.current?.click()} className="h-11 px-5 text-sm font-medium text-ink">
        Choose a recording
      </PadButton>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        aria-label="Choose a recording"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ''; // choosing the same file again still fires
          if (file) onFile(file);
        }}
      />
      <p className="text-xs leading-relaxed text-ink-faint">
        or drop it here · {formats.map((f) => f.label).join(', ')} · up to {formatSeconds(MAX_DURATION_SECONDS)} and{' '}
        {formatBytes(MAX_FILE_BYTES)}
        <br />
        Piano only works best. You can also open a MIDI file or saved FunKeys notes.
      </p>
      <p className="flex items-center gap-1.5 text-xs text-ink-faint">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
          <rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.3" />
        </svg>
        Processed on your device. Nothing is uploaded or stored.
      </p>
    </div>
  );
}

function Working({ t }: { t: TranscriptionControls }) {
  const fraction = t.progress?.fraction ?? 0;
  const percent = Math.round(fraction * 100);
  const label = t.progress ? STAGE_LABELS[t.progress.stage] : 'Starting';
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-white/[0.06] bg-panel-sunk/60 px-5 py-6" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-ink">
          <Led on blink />
          {label}…
        </p>
        <span className="text-sm tabular-nums text-ink-muted">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label="Transcription progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${label}, ${percent}%`}
        className="h-2 overflow-hidden rounded-full bg-black/50"
      >
        <div className="h-full rounded-full bg-led shadow-[0_0_10px_var(--led)] transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-ink-faint">
        <span>
          {t.progress?.backend === 'cpu'
            ? 'Running on the processor (no GPU available here): a long recording can take several minutes.'
            : t.progress?.backend === 'webgl'
              ? 'Running on your graphics card.'
              : 'You can keep playing while it works.'}
        </span>
        <PadButton onClick={t.cancel} className="px-3 py-1.5 text-xs text-ink">
          Cancel
        </PadButton>
      </div>
    </div>
  );
}

// ── Detection settings ─────────────────────────────────────────────────

function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm text-ink-muted">
      <span className="flex justify-between gap-2">
        {label} <span className="tabular-nums text-ink">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer accent-led"
      />
      <span className="text-xs text-ink-faint">{hint}</span>
    </label>
  );
}

function Settings({ t, compact = false }: { t: TranscriptionControls; compact?: boolean }) {
  const set = (patch: Partial<TranscriptionSettings>) => t.setSettings({ ...t.settings, ...patch });
  return (
    <details className="group rounded-xl border border-white/[0.06] bg-panel-sunk/40 p-4 [&_summary::-webkit-details-marker]:hidden" open={!compact}>
      <summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-ink">
        Detection settings
        <span className="text-ink-faint transition-transform group-open:rotate-180" aria-hidden="true">
          ▾
        </span>
      </summary>
      <div className="mt-4 flex flex-col gap-4">
        <Slider
          label="Note threshold"
          hint="Lower finds quieter notes, and more mistakes."
          value={t.settings.onsetThreshold}
          min={0.2}
          max={0.8}
          step={0.05}
          format={(v) => v.toFixed(2)}
          onChange={(onsetThreshold) => set({ onsetThreshold })}
        />
        <Slider
          label="Sustain threshold"
          hint="Lower lets notes ring longer."
          value={t.settings.frameThreshold}
          min={0.1}
          max={0.6}
          step={0.05}
          format={(v) => v.toFixed(2)}
          onChange={(frameThreshold) => set({ frameThreshold })}
        />
        <Slider
          label="Shortest note"
          hint="Shorter catches fast runs; longer ignores clicks."
          value={t.settings.minNoteMs}
          min={20}
          max={200}
          step={5}
          format={(v) => `${v} ms`}
          onChange={(minNoteMs) => set({ minNoteMs })}
        />
        <label className="flex items-start gap-2.5 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={t.settings.removeOvertones}
            onChange={(e) => set({ removeOvertones: e.target.checked })}
            className="mt-0.5 h-4 w-4 accent-led"
          />
          <span>
            Remove likely overtones
            <span className="block text-xs text-ink-faint">Drops faint notes an octave or more above a louder one.</span>
          </span>
        </label>
        {t.canRetry && t.status !== 'working' && (
          <PadButton onClick={t.retry} className="h-9 px-3 text-sm text-ink">
            Transcribe again with these settings
          </PadButton>
        )}
      </div>
    </details>
  );
}

// ── The result ─────────────────────────────────────────────────────────

const ORIGIN_LABEL = { audio: 'Transcribed from audio', midi: 'MIDI file', notes: 'FunKeys notes' } as const;

function Editor({ t, player, octaveShift, onPreview }: Omit<AudioPanelProps, 'transcription'> & { t: TranscriptionControls }) {
  const { editor, dispatch, info } = t;
  const notes = editor.notes;
  const selected = notes.find((n) => n.id === editor.selectedId) ?? null;
  const range = pitchRange(notes);
  const keys = keyboardRange(octaveShift);
  const outside = notes.filter((n) => n.midi < keys.low || n.midi > keys.high).length;
  const title = info?.title ?? 'Transcription';
  const state = t.isLoaded ? player.state : 'stopped';
  const playback = t.isLoaded ? player : null;

  const seek = (seconds: number) => {
    if (!t.isLoaded) player.load({ kind: 'transcription', title }, notes, editor.duration);
    player.seek(seconds);
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs text-ink-faint">
            <Led on={state === 'playing'} />
            {info ? ORIGIN_LABEL[info.origin] : ''}
            {info?.backend && ` · ${info.backend === 'webgl' ? 'GPU' : 'CPU'}`}
          </p>
          <h3 className="mt-1 truncate text-lg font-medium text-ink">{title}</h3>
          <p className="text-sm text-ink-muted">
            {formatSeconds(editor.duration)} · {notes.length} notes
            {range && ` · ${midiToNoteId(range.low)}–${midiToNoteId(range.high)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PadButton
            onClick={() => downloadFile(`${fileStem(title)}.mid`, writeMidiFile(notes, { name: title }) as BlobPart, 'audio/midi')}
            disabled={notes.length === 0}
            className="h-9 px-3 text-sm text-ink"
          >
            Export MIDI
          </PadButton>
          <PadButton
            onClick={() =>
              downloadFile(`${fileStem(title)}.funkeys.json`, serializeNotes({ title, duration: editor.duration, notes }), 'application/json')
            }
            disabled={notes.length === 0}
            className="h-9 px-3 text-sm text-ink"
          >
            Save notes
          </PadButton>
          <PadButton onClick={t.reset} className="h-9 px-3 text-sm text-ink-muted hover:text-ink">
            New file
          </PadButton>
        </div>
      </div>

      {info?.origin === 'audio' && (
        <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 text-xs leading-relaxed text-ink-muted">
          Automatic transcription is an estimate: some notes may be wrong or missing. Select a note to fix it, or
          double-click the roll to add one. What you hear is the FunKeys piano playing these notes, not the recording.
        </p>
      )}
      {notes.length === 0 && (
        <p role="status" className="rounded-lg border border-dashed border-white/10 px-3.5 py-3 text-sm text-ink-muted">
          No notes were found. Is it a piano recording? Try a lower note threshold below and transcribe again, or add
          notes by double-clicking the roll.
        </p>
      )}
      {outside > 0 && (
        <p className="text-xs text-ink-faint">
          {outside} of {notes.length} notes are outside the keyboard’s {keyboardRangeLabel(octaveShift)}. They still
          play; shift the octave to see them light up.
        </p>
      )}

      <PlaybackBar
        label="Transcription playback"
        state={state}
        duration={editor.duration}
        getPosition={player.getPosition}
        revision={player.revision}
        onPlay={t.play}
        onPause={player.pause}
        onStop={player.stop}
        onSeek={seek}
        rate={player.rate}
        onRateChange={player.setRate}
        loop={t.isLoaded ? player.loop : false}
        onLoopChange={(loop) => {
          if (!t.isLoaded) player.load({ kind: 'transcription', title }, notes, editor.duration);
          player.setLoop(loop);
        }}
      />

      <PianoRoll
        notes={notes}
        duration={editor.duration}
        selectedId={editor.selectedId}
        playback={playback}
        onSelect={(id) => dispatch({ type: 'select', id })}
        onSeek={seek}
        onAdd={(midi, startTime) => dispatch({ type: 'add', midi, startTime })}
        onDelete={(id) => dispatch({ type: 'delete', id })}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <NoteInspector
          note={selected}
          onEdit={(edit) => selected && dispatch({ type: 'edit', id: selected.id, edit })}
          onDelete={() => selected && dispatch({ type: 'delete', id: selected.id })}
          onPreview={onPreview}
        />
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <PadButton
              onClick={() =>
                dispatch({
                  type: 'add',
                  midi: selected?.midi ?? 60,
                  startTime: t.isLoaded ? player.getPosition() : selected ? selected.endTime : 0,
                })
              }
              className="h-9 px-3 text-sm text-ink"
            >
              + Add note
            </PadButton>
            <PadButton onClick={() => dispatch({ type: 'undo' })} disabled={editor.past.length === 0} className="h-9 px-3 text-sm text-ink">
              Undo
            </PadButton>
            <PadButton onClick={() => dispatch({ type: 'redo' })} disabled={editor.future.length === 0} className="h-9 px-3 text-sm text-ink">
              Redo
            </PadButton>
          </div>
          {info?.origin === 'audio' && <Settings t={t} compact />}
        </div>
      </div>
    </>
  );
}
