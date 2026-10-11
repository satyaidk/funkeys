/**
 * @fileoverview Notes: a library of songs that play on the keyboard.
 *
 * Search, filter by category and difficulty, keep favorites, and play any
 * song through the piano: its keys light up as it plays. The selected song
 * sits at the top with its notes drawn as a mini piano roll, a seek bar,
 * practice speed and loop.
 *
 * "Curated picks" are a hand-picked set, labelled as such: there is no live
 * chart data behind them. Shuffle draws a different set.
 *
 * Choosing another song while one is playing switches straight to it.
 */

'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import {
  CATEGORIES,
  curatedPicks,
  CURATED_PICKS,
  DIFFICULTIES,
  Difficulty,
  filterSongs,
  Song,
  SongCategory,
  songTimeline,
  SOURCE_LABELS,
} from '@/lib/music/songs';
import { favoritesStore } from '@/lib/favorites';
import { formatSeconds } from '@/lib/format';
import { SequencePlayerControls } from '@/hooks/useSequencePlayer';
import PlaybackBar, { PlayIcon } from '../../playback/PlaybackBar';
import NotePreview from '../../playback/NotePreview';
import ChipGroup, { ChipOption } from '../../ui/ChipGroup';
import PadButton from '../../ui/PadButton';
import Led from '../../ui/Led';

interface NotesPanelProps {
  songs: readonly Song[];
  player: SequencePlayerControls;
}

type CategoryFilter = SongCategory | 'all' | 'curated';

const CATEGORY_OPTIONS: readonly ChipOption<CategoryFilter>[] = [
  { value: 'all', label: 'All' },
  { value: 'curated', label: CURATED_PICKS.title },
  ...CATEGORIES.map((c) => ({ value: c.id, label: c.label })),
];

const DIFFICULTY_LABEL = Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d.label])) as Record<Difficulty, string>;

/** Timeline of a song, or null if it can't be read (shown as an error on its card) */
function safeTimeline(song: Song) {
  try {
    return songTimeline(song);
  } catch {
    return null;
  }
}

export default function NotesPanel({ songs, player }: NotesPanelProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [difficulty, setDifficulty] = useState<Difficulty | 'all'>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [seed, setSeed] = useState(7);
  const [selectedId, setSelectedId] = useState(songs[0]?.id ?? '');
  const favorites = useSyncExternalStore(
    favoritesStore.subscribe,
    favoritesStore.getSnapshot,
    favoritesStore.getServerSnapshot
  );

  const loadedId = player.source?.kind === 'song' ? player.source.id : null;
  const selected = songs.find((s) => s.id === selectedId) ?? songs[0];
  const isLoaded = loadedId === selected?.id;

  const results = useMemo(
    () => filterSongs(songs, { query, category, difficulty, only: favoritesOnly ? favorites : null }),
    [songs, query, category, difficulty, favoritesOnly, favorites]
  );
  const picks = useMemo(() => curatedPicks(songs, seed), [songs, seed]);
  const browsing = query === '' && category === 'all' && difficulty === 'all' && !favoritesOnly;

  /** Load a song into the transport (stopping whatever was playing) */
  const load = (song: Song) => {
    const timeline = safeTimeline(song);
    if (!timeline) return false;
    player.load({ kind: 'song', id: song.id, title: song.title }, timeline.notes, timeline.duration, {
      loop: song.loop ?? false,
    });
    return true;
  };

  /** Select a song; if a song is playing, switch straight to this one */
  const select = (song: Song) => {
    setSelectedId(song.id);
    if (loadedId && player.state === 'playing' && loadedId !== song.id && load(song)) player.play();
  };

  const playSong = (song: Song) => {
    setSelectedId(song.id);
    if (loadedId === song.id) {
      player.toggle();
      return;
    }
    if (load(song)) player.play();
  };

  const clearFilters = () => {
    setQuery('');
    setCategory('all');
    setDifficulty('all');
    setFavoritesOnly(false);
  };

  const card = (song: Song) => (
    <SongCard
      key={song.id}
      song={song}
      selected={song.id === selected?.id}
      playing={loadedId === song.id && player.state === 'playing'}
      favorite={favorites.has(song.id)}
      onSelect={() => select(song)}
      onPlay={() => playSong(song)}
      onFavorite={() => favoritesStore.toggle(song.id)}
    />
  );

  const timeline = selected ? safeTimeline(selected) : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:items-start">
      {/* ── The selected song ─────────────────────────────────────────── */}
      {selected && (
        <section
          aria-label="Selected song"
          className="flex min-w-0 flex-col gap-3 rounded-xl border border-white/[0.06] bg-panel-sunk/70 p-3.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.03)] sm:p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-xs text-ink-faint">
                <Led on={isLoaded && player.state === 'playing'} />
                {isLoaded && player.state === 'playing' ? 'Playing' : isLoaded && player.state === 'paused' ? 'Paused' : 'Selected'}
              </p>
              <h3 className="mt-1 text-lg font-medium leading-snug text-ink">{selected.title}</h3>
              <p className="truncate text-sm text-ink-muted">{selected.artist}</p>
            </div>
            <FavoriteButton
              title={selected.title}
              on={favorites.has(selected.id)}
              onToggle={() => favoritesStore.toggle(selected.id)}
            />
          </div>

          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <Badge>{DIFFICULTY_LABEL[selected.difficulty]}</Badge>
            <Badge>{SOURCE_LABELS[selected.source]}</Badge>
            <Badge>
              {Math.round(selected.bpm * (isLoaded ? player.rate : 1))} BPM · {selected.timeSignature}
            </Badge>
          </div>

          {timeline ? (
            <>
              <NotePreview
                notes={timeline.notes}
                duration={timeline.duration}
                playback={isLoaded ? player : null}
              />
              <PlaybackBar
                label="Song playback"
                state={isLoaded ? player.state : 'stopped'}
                duration={timeline.duration}
                getPosition={player.getPosition}
                revision={player.revision}
                onPlay={() => (isLoaded ? player.play() : load(selected) && player.play())}
                onPause={player.pause}
                onStop={player.stop}
                onSeek={(t) => {
                  if (!isLoaded) load(selected);
                  player.seek(t);
                }}
                rate={player.rate}
                onRateChange={player.setRate}
                loop={isLoaded ? player.loop : (selected.loop ?? false)}
                onLoopChange={(loop) => {
                  if (!isLoaded) load(selected);
                  player.setLoop(loop);
                }}
              />
            </>
          ) : (
            <p role="alert" className="text-sm text-rec">
              This song’s notes couldn’t be read, so it can’t be played.
            </p>
          )}

          <p className="text-xs leading-relaxed text-ink-faint">{selected.attribution}</p>
        </section>
      )}

      {/* ── Browse ────────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-0 flex-1 basis-56">
              <span className="sr-only">Search songs</span>
              <svg
                viewBox="0 0 16 16"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
                aria-hidden="true"
              >
                <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title, artist or style"
                className="h-10 w-full rounded-lg border border-white/[0.08] bg-panel-sunk pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint shadow-[inset_0_1px_3px_rgb(0_0_0/0.5)] focus:border-[rgb(255_181_71/0.5)]"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <span className="sr-only sm:not-sr-only">Level</span>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty | 'all')}
                aria-label="Difficulty"
                className="h-10 rounded-lg border border-white/[0.08] bg-panel-sunk px-2.5 text-sm text-ink"
              >
                <option value="all">All levels</option>
                {DIFFICULTIES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <PadButton
              aria-pressed={favoritesOnly}
              active={favoritesOnly}
              onClick={() => setFavoritesOnly((v) => !v)}
              className="flex h-10 items-center gap-2 px-3 text-sm text-ink"
            >
              <Star on={favoritesOnly} />
              Favorites
            </PadButton>
          </div>
          <ChipGroup label="Category" options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />
        </div>

        {browsing && (
          <section aria-labelledby="curated-picks-heading" className="flex flex-col gap-2.5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h3 id="curated-picks-heading" className="text-sm font-medium text-ink">
                  {CURATED_PICKS.title}
                </h3>
                <p className="text-xs text-ink-faint">
                  {CURATED_PICKS.note} Updated {CURATED_PICKS.updated}.
                </p>
              </div>
              <PadButton onClick={() => setSeed((s) => s + 1)} className="shrink-0 px-3 py-1.5 text-xs text-ink-muted hover:text-ink">
                Shuffle
              </PadButton>
            </div>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">{picks.map(card)}</ul>
          </section>
        )}

        <section aria-labelledby="all-songs-heading" className="flex flex-col gap-2.5">
          <h3 id="all-songs-heading" className="text-sm text-ink-muted" aria-live="polite">
            {browsing ? 'All songs' : 'Results'} <span className="text-ink-faint">· {results.length}</span>
          </h3>
          {results.length > 0 ? (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">{results.map(card)}</ul>
          ) : (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-white/10 p-5 text-sm text-ink-muted">
              <p>
                {favoritesOnly && favorites.size === 0
                  ? 'No favorites yet. Tap the star on a song to keep it here.'
                  : 'No songs match these filters.'}
              </p>
              <PadButton onClick={clearFilters} className="px-3 py-1.5 text-xs text-ink">
                Clear filters
              </PadButton>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ── Pieces ─────────────────────────────────────────────────────────────

function SongCard({
  song,
  selected,
  playing,
  favorite,
  onSelect,
  onPlay,
  onFavorite,
}: {
  song: Song;
  selected: boolean;
  playing: boolean;
  favorite: boolean;
  onSelect: () => void;
  onPlay: () => void;
  onFavorite: () => void;
}) {
  const timeline = safeTimeline(song);
  return (
    <li
      className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors ${
        selected
          ? 'border-[rgb(255_181_71/0.35)] bg-[rgb(255_181_71/0.07)]'
          : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14]'
      }`}
    >
      <PadButton
        aria-label={`${playing ? 'Pause' : 'Play'} ${song.title}`}
        active={playing}
        disabled={!timeline}
        onClick={onPlay}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full! text-ink"
      >
        <PlayIcon playing={playing} className="h-3.5 w-3.5" />
      </PadButton>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected || undefined}
        className="min-w-0 flex-1 rounded-md py-0.5 text-left"
      >
        <span className="block truncate text-sm font-medium text-ink">{song.title}</span>
        <span className="block truncate text-xs text-ink-muted">{song.artist}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-faint">
          <span>{DIFFICULTY_LABEL[song.difficulty]}</span>
          <span aria-hidden="true">·</span>
          <span>{SOURCE_LABELS[song.source]}</span>
          {timeline ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{formatSeconds(timeline.duration)}</span>
            </>
          ) : (
            <span className="text-rec">Can’t be played</span>
          )}
        </span>
      </button>
      <FavoriteButton title={song.title} on={favorite} onToggle={onFavorite} />
    </li>
  );
}

function FavoriteButton({ title, on, onToggle }: { title: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Favorite ${title}`}
      aria-pressed={on}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onToggle}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors ${
        on ? 'text-led' : 'text-ink-faint hover:text-ink'
      }`}
    >
      <Star on={on} />
    </button>
  );
}

function Star({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
      <path
        d="M8 1.6l1.9 4 4.3.5-3.2 3 .9 4.3L8 11.2l-3.9 2.2.9-4.3-3.2-3 4.3-.5z"
        fill={on ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-ink-muted">{children}</span>
  );
}
