import { describe, it, expect, beforeEach, vi } from 'vitest';
import { favoritesStore } from './favorites';

describe('favoritesStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    favoritesStore.reset();
  });

  it('starts empty, and empty on the server', () => {
    expect(favoritesStore.getSnapshot().size).toBe(0);
    expect(favoritesStore.getServerSnapshot().size).toBe(0);
  });

  it('toggles a favorite, saves it and tells subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = favoritesStore.subscribe(listener);
    favoritesStore.toggle('twinkle');
    expect(favoritesStore.getSnapshot().has('twinkle')).toBe(true);
    expect(JSON.parse(window.localStorage.getItem('funkeys:favorites')!)).toEqual(['twinkle']);
    expect(listener).toHaveBeenCalled();

    favoritesStore.toggle('twinkle');
    expect(favoritesStore.getSnapshot().has('twinkle')).toBe(false);
    unsubscribe();
  });

  it('returns the same snapshot until something changes (no needless re-renders)', () => {
    expect(favoritesStore.getSnapshot()).toBe(favoritesStore.getSnapshot());
  });

  it('reads what an earlier visit saved, ignoring junk', () => {
    window.localStorage.setItem('funkeys:favorites', JSON.stringify(['a', 3, 'b']));
    expect([...favoritesStore.getSnapshot()]).toEqual(['a', 'b']);
    favoritesStore.reset();
    window.localStorage.setItem('funkeys:favorites', '{not json');
    expect(favoritesStore.getSnapshot().size).toBe(0);
  });
});
