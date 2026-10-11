/**
 * @fileoverview Favorite songs, remembered in the browser (localStorage).
 *
 * A tiny external store for `useSyncExternalStore`: React asks for a
 * snapshot, and re-renders when the store says it changed. On the server
 * (and during hydration) the snapshot is empty, so the HTML always matches;
 * saved favorites appear right after.
 *
 * localStorage can be missing or full (private mode, quotas): every access
 * is guarded, and favorites then simply last until the page is closed.
 */

const KEY = 'funkeys:favorites';
const EMPTY: ReadonlySet<string> = new Set();

let cache: ReadonlySet<string> | null = null;
const listeners = new Set<() => void>();

function read(): ReadonlySet<string> {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return EMPTY;
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

export const favoritesStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    // Another tab changed them
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY) return;
      cache = null;
      listener();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener('storage', onStorage);
    };
  },

  getSnapshot(): ReadonlySet<string> {
    cache ??= read();
    return cache;
  },

  getServerSnapshot(): ReadonlySet<string> {
    return EMPTY;
  },

  toggle(id: string): void {
    const next = new Set(favoritesStore.getSnapshot());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    cache = next;
    try {
      window.localStorage.setItem(KEY, JSON.stringify([...next]));
    } catch {
      /* storage unavailable: keep them for this visit only */
    }
    emit();
  },

  /** Forget the cached value (tests) */
  reset(): void {
    cache = null;
  },
};
