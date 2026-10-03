/**
 * @fileoverview The characters printed on the user's own keyboard.
 *
 * Notes are mapped by physical key position, so on a French AZERTY
 * keyboard the key in the "Q" position is labelled "A". The Keyboard Map
 * API (Chrome, Edge, Opera) reports each physical key's label for the
 * current layout, so the on-screen keys can show what's really printed on
 * the user's keyboard. Other browsers keep the US QWERTY labels.
 */

'use client';

import { useEffect, useState } from 'react';

interface KeyboardLayoutMap {
  get(code: string): string | undefined;
  forEach(callback: (value: string, key: string) => void): void;
}

type NavigatorWithKeyboard = Navigator & {
  keyboard?: { getLayoutMap?: () => Promise<KeyboardLayoutMap> };
};

/** Map of `KeyboardEvent.code` → uppercase label, or `null` if unsupported */
export function useKeyboardLabels(): ReadonlyMap<string, string> | null {
  const [labels, setLabels] = useState<ReadonlyMap<string, string> | null>(null);

  useEffect(() => {
    const getLayoutMap = (navigator as NavigatorWithKeyboard).keyboard?.getLayoutMap;
    if (!getLayoutMap) return;

    let cancelled = false;
    getLayoutMap
      .call((navigator as NavigatorWithKeyboard).keyboard)
      .then((layout) => {
        if (cancelled) return;
        const map = new Map<string, string>();
        layout.forEach((value, code) => map.set(code, value.toUpperCase()));
        setLabels(map);
      })
      .catch(() => {
        /* not allowed here (e.g. in an iframe): keep the default labels */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return labels;
}
