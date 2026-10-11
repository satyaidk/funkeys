/**
 * @fileoverview The page header: the FunKeys name, quick links to the Notes
 * library and Audio to Piano, keyboard shortcuts, and the repository.
 */

'use client';

import { TabId } from '../console/FunctionTabs';

const REPO_URL = 'https://github.com/satyaidk/funkeys';

interface AppHeaderProps {
  /** Open a page of the function panel */
  onNavigate: (tab: TabId) => void;
  onShowShortcuts: () => void;
}

const LINK =
  'inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-ink-muted transition-colors hover:bg-white/[0.05] hover:text-ink sm:px-3';

export default function AppHeader({ onNavigate, onShowShortcuts }: AppHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-1">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight [font-stretch:90%] sm:text-3xl">
          Fun<span className="text-led">Keys</span>
        </h1>
        <p className="mt-0.5 text-sm text-ink-muted sm:text-base">Made With Love and With Curiosity Of Music</p>
      </div>
      <nav aria-label="Main" className="-ml-2 flex flex-wrap items-center sm:ml-0">
        <button type="button" onClick={() => onNavigate('notes')} className={LINK}>
          Notes
        </button>
        <button type="button" onClick={() => onNavigate('audio')} className={LINK}>
          Audio to Piano
        </button>
        <button type="button" onClick={onShowShortcuts} className={LINK} aria-haspopup="dialog">
          <kbd className="rounded border border-white/15 px-1 font-sans text-[11px] leading-4">?</kbd>
          <span className="hidden sm:inline">Shortcuts</span>
          <span className="sr-only sm:hidden">Keyboard shortcuts</span>
        </button>
        <a href={REPO_URL} className={LINK} aria-label="FunKeys on GitHub (open for contributions)">
          <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
            <path
              fill="currentColor"
              d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.22 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8z"
            />
          </svg>
          <span className="hidden md:inline">Contribute</span>
        </a>
      </nav>
    </header>
  );
}
