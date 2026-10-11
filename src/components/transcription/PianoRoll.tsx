/**
 * @fileoverview A piano roll: every note drawn as a bar, time across, pitch up.
 *
 * ```
 *  C5 │      ▬▬▬       ▬▬               ruler: click to jump there
 *     │  ▬▬       ▬▬▬▬     ▬▬▬    │     ▬ a note (rainbow color, brighter = louder)
 *  C4 │▬▬▬▬▬▬            ▬▬▬▬▬▬▬▬ │ ◄── playhead
 * ```
 *
 * - **Click a note** to select it (the inspector beside edits it);
 *   **double-click empty space** to add a note there
 * - **← →** select the previous / next note, **Delete** removes it
 * - **− +** zoom; the view follows the playhead while playing
 *
 * ## Performance
 * A five-minute transcription can hold thousands of notes and be tens of
 * thousands of pixels wide. Instead of one huge canvas (browsers cap their
 * size), a canvas the size of the *visible* window sits still while an
 * empty spacer provides the scroll width; each frame draws only the notes
 * in view, found by binary search on their start times.
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PianoNoteEvent } from '@/types';
import { getNoteColor, getNoteName, midiToNoteId } from '@/lib/music/notes';
import { pitchRange } from '@/lib/music/note-events';
import { PlaybackState } from '@/lib/audio/sequence-player';
import { formatSeconds } from '@/lib/format';
import PadButton from '../ui/PadButton';

interface PianoRollProps {
  notes: readonly PianoNoteEvent[];
  duration: number;
  selectedId: string | null;
  playback: { state: PlaybackState; getPosition: () => number; revision: number } | null;
  onSelect: (id: string | null) => void;
  onSeek: (seconds: number) => void;
  onAdd: (midi: number, startTime: number) => void;
  onDelete: (id: string) => void;
}

const GUTTER = 34; // pitch labels
const RULER = 18; // time ruler
const MIN_ZOOM = 8;
const MAX_ZOOM = 480;
const BLACK = new Set([1, 3, 6, 8, 10]);

/** Index of the first note starting at or after `time` */
function firstFrom(notes: readonly PianoNoteEvent[], time: number): number {
  let low = 0;
  let high = notes.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (notes[mid].startTime < time) low = mid + 1;
    else high = mid;
  }
  return low;
}

export default function PianoRoll({ notes, duration, selectedId, playback, onSelect, onSeek, onAdd, onDelete }: PianoRollProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null); // px per second; null = fit
  const [scrollLeft, setScrollLeft] = useState(0);
  const followRef = useRef(true);

  const range = useMemo(() => {
    const r = pitchRange(notes) ?? { low: 57, high: 72 };
    // At least two octaves tall, with a little room above and below
    const pad = Math.max(2, Math.ceil((24 - (r.high - r.low)) / 2));
    return { low: Math.max(21, r.low - pad), high: Math.min(108, r.high + pad) };
  }, [notes]);
  const rows = range.high - range.low + 1;
  const length = Math.max(duration, 0.5);
  const fitZoom = width > GUTTER ? (width - GUTTER - 8) / length : 60;
  const pps = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom ?? Math.max(fitZoom, Math.min(60, MAX_ZOOM))));
  const contentWidth = GUTTER + length * pps + 8;

  // Track the visible width
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const measure = () => setWidth(scroller.clientWidth);
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(scroller);
    return () => observer?.disconnect();
  }, []);

  // ── Drawing ───────────────────────────────────────────────────────────
  const draw = useCallback(
    (position: number | null) => {
      const canvas = canvasRef.current;
      const scroller = scrollerRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !scroller || !ctx || width === 0) return;

      const height = scroller.clientHeight;
      const ratio = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

      const left = scroller.scrollLeft;
      const rowHeight = (height - RULER) / rows;
      const xOf = (t: number) => GUTTER + t * pps - left;
      const yOf = (midi: number) => RULER + (range.high - midi) * rowHeight;

      // Rows: black-key rows darker, a line under every C
      ctx.fillStyle = '#121016';
      ctx.fillRect(0, 0, width, height);
      for (let midi = range.low; midi <= range.high; midi++) {
        const y = yOf(midi);
        if (BLACK.has(midi % 12)) {
          ctx.fillStyle = '#0c0a0e';
          ctx.fillRect(GUTTER, y, width, rowHeight);
        }
        if (midi % 12 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fillRect(GUTTER, y + rowHeight - 1, width, 1);
        }
      }

      // Seconds grid and ruler labels
      const step = pps >= 60 ? 1 : pps >= 20 ? 5 : pps >= 8 ? 10 : 30;
      const startT = Math.max(0, Math.floor((left - GUTTER) / pps / step) * step);
      ctx.font = '10px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      for (let t = startT; t <= length; t += step) {
        const x = xOf(t);
        if (x > width) break;
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(x, RULER, 1, height - RULER);
        ctx.fillStyle = '#6f6676';
        ctx.fillText(formatSeconds(t), x + 3, RULER / 2);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(0, RULER - 1, width, 1);

      // Notes in view (a note can start before the view and reach into it: look back 30 s)
      const viewStart = (left - GUTTER) / pps;
      const viewEnd = viewStart + width / pps;
      for (let i = firstFrom(notes, viewStart - 30); i < notes.length && notes[i].startTime <= viewEnd; i++) {
        const n = notes[i];
        if (n.endTime < viewStart || n.midi < range.low || n.midi > range.high) continue;
        const x = xOf(n.startTime);
        const w = Math.max(2, (n.endTime - n.startTime) * pps);
        const y = yOf(n.midi) + 0.5;
        const h = Math.max(2, rowHeight - 1);
        ctx.globalAlpha = 0.45 + 0.55 * n.velocity;
        ctx.fillStyle = getNoteColor(getNoteName(n.midi));
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, Math.min(3, h / 2));
        else ctx.rect(x, y, w, h); // older browsers
        ctx.fill();
        ctx.globalAlpha = 1;
        if (n.id === selectedId) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
        }
      }

      // Pitch labels in the gutter
      ctx.fillStyle = '#17141b';
      ctx.fillRect(0, 0, GUTTER, height);
      ctx.fillStyle = '#a59cab';
      for (let midi = range.low; midi <= range.high; midi++) {
        if (midi % 12 === 0 || (rowHeight >= 9 && !BLACK.has(midi % 12))) {
          ctx.fillText(midiToNoteId(midi), 4, yOf(midi) + rowHeight / 2);
        }
      }

      // Playhead
      if (position !== null) {
        const x = xOf(position);
        if (x >= GUTTER && x <= width) {
          ctx.fillStyle = '#ffb547';
          ctx.fillRect(x - 1, 0, 2, height);
        }
      }
    },
    [notes, selectedId, width, rows, range, pps, length]
  );

  // Redraw on changes, and every frame while playing (following the playhead)
  const state = playback?.state ?? 'stopped';
  const getPosition = playback?.getPosition;
  const revision = playback?.revision ?? 0;
  useEffect(() => {
    let frame = 0;
    const render = () => {
      const position = getPosition ? getPosition() : null;
      const scroller = scrollerRef.current;
      if (scroller && position !== null && state === 'playing' && followRef.current) {
        const x = GUTTER + position * pps - scroller.scrollLeft;
        if (x > scroller.clientWidth - 40 || x < GUTTER) scroller.scrollLeft = Math.max(0, position * pps - scroller.clientWidth * 0.2);
      }
      draw(state === 'stopped' && position === 0 ? null : position);
      if (state === 'playing') frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [draw, state, getPosition, revision, scrollLeft, pps]);

  // ── Input ─────────────────────────────────────────────────────────────
  const locate = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const left = scrollerRef.current?.scrollLeft ?? 0;
    const rowHeight = (rect.height - RULER) / rows;
    return {
      x,
      y,
      time: Math.max(0, (x + left - GUTTER) / pps),
      midi: range.high - Math.floor((y - RULER) / rowHeight),
      rowHeight,
    };
  };

  const noteAt = (time: number, midi: number, slack: number) =>
    notes.find((n) => Math.abs(n.midi - midi) <= slack && time >= n.startTime - 0.03 && time <= n.endTime + 0.03) ??
    null;

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const { x, y, time, midi, rowHeight } = locate(e);
    if (x < GUTTER) return;
    if (y < RULER) {
      onSeek(Math.min(length, time));
      return;
    }
    // Small rows are hard to hit: accept the row above or below too
    const hit = noteAt(time, midi, 0) ?? (rowHeight < 8 ? noteAt(time, midi, 1) : null);
    onSelect(hit?.id ?? null);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y, time, midi } = locate(e);
    if (x < GUTTER || y < RULER || noteAt(time, midi, 0)) return;
    onAdd(midi, Math.round(time * 100) / 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const index = notes.findIndex((n) => n.id === selectedId);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault(); // keep ← → from shifting the keyboard's octave
      const next = notes[Math.min(notes.length - 1, Math.max(0, index + (e.key === 'ArrowRight' ? 1 : -1)))];
      if (next) {
        onSelect(next.id);
        const scroller = scrollerRef.current;
        if (scroller) {
          const x = GUTTER + next.startTime * pps;
          if (x < scroller.scrollLeft + GUTTER || x > scroller.scrollLeft + scroller.clientWidth - 40) {
            scroller.scrollLeft = Math.max(0, x - scroller.clientWidth / 3);
          }
        }
      }
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
      e.preventDefault();
      onDelete(selectedId);
    } else if (e.key === 'Escape') {
      onSelect(null);
    }
  };

  const zoomBy = (factor: number) => setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pps * factor)));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 text-xs text-ink-faint">
        <span>
          {notes.length} notes · tap a note to edit it · double-click empty space to add one
        </span>
        <div className="flex items-center gap-1.5" role="group" aria-label="Zoom">
          <PadButton aria-label="Zoom out" onClick={() => zoomBy(0.5)} disabled={pps <= MIN_ZOOM} className="flex h-8 w-8 items-center justify-center text-ink">
            −
          </PadButton>
          <PadButton aria-label="Fit to width" onClick={() => setZoom(null)} className="h-8 px-2 text-ink-muted hover:text-ink">
            Fit
          </PadButton>
          <PadButton aria-label="Zoom in" onClick={() => zoomBy(2)} disabled={pps >= MAX_ZOOM} className="flex h-8 w-8 items-center justify-center text-ink">
            +
          </PadButton>
        </div>
      </div>
      <div
        ref={scrollerRef}
        onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}
        onPointerDown={() => (followRef.current = false)}
        onPointerUp={() => (followRef.current = true)}
        className="relative h-56 overflow-x-auto overflow-y-hidden rounded-lg border border-white/[0.06] bg-[#121016] sm:h-64"
      >
        <div style={{ width: contentWidth, height: '100%' }}>
          <canvas
            ref={canvasRef}
            tabIndex={0}
            role="application"
            aria-label={`Piano roll: ${notes.length} notes over ${formatSeconds(length)}. Use the left and right arrow keys to select notes, Delete to remove one.`}
            onPointerDown={handlePointerDown}
            onDoubleClick={handleDoubleClick}
            onKeyDown={handleKeyDown}
            className="sticky left-0 block h-full cursor-pointer touch-pan-x"
            style={{ width: width || '100%' }}
          />
        </div>
      </div>
    </div>
  );
}
