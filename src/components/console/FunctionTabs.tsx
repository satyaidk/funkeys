/**
 * @fileoverview Function pages of the control panel, as accessible tabs.
 *
 * Each tab carries an LED that lights when its page holds a non-default
 * setting (e.g. Tuning lights when transposed), so you can see at a glance
 * what's changed without opening every page.
 *
 * Keyboard: arrow keys move between tabs (WAI-ARIA tabs pattern).
 */

'use client';

import { useId, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Led from '../ui/Led';
import { preventMouseFocus } from '../ui/PadButton';

export type TabId = 'voice' | 'layer' | 'sound' | 'tuning' | 'metronome';

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: 'voice', label: 'Voice' },
  { id: 'layer', label: 'Layer & split' },
  { id: 'sound', label: 'Sound' },
  { id: 'tuning', label: 'Tuning' },
  { id: 'metronome', label: 'Metronome' },
];

interface FunctionTabsProps {
  panels: Record<TabId, React.ReactNode>;
  /** Which tabs hold a changed setting (lights their LED) */
  indicators: Partial<Record<TabId, boolean>>;
  /** Extra controls at the end of the tab bar */
  actions?: React.ReactNode;
}

export default function FunctionTabs({ panels, indicators, actions }: FunctionTabsProps) {
  const [active, setActive] = useState<TabId>('voice');
  const id = useId();
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const index = TABS.findIndex((t) => t.id === active);
    const moves: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: TABS.length - 1 };
    if (!(e.key in moves)) return;
    e.preventDefault();
    const next = (moves[e.key] + TABS.length) % TABS.length;
    setActive(TABS[next].id);
    tabsRef.current[next]?.focus();
  };

  return (
    <div>
      <div className="flex items-end justify-between gap-3 border-b border-black/50 shadow-[0_1px_0_rgb(255_255_255/0.04)]">
        <div role="tablist" aria-label="Piano functions" onKeyDown={handleKeyDown} className="scroll-rail -mb-px flex overflow-x-auto">
          {TABS.map((tab, i) => {
            const selected = tab.id === active;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabsRef.current[i] = el;
                }}
                id={`${id}-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${id}-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                onMouseDown={preventMouseFocus}
                onClick={() => setActive(tab.id)}
                className={`relative flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm transition-colors ${
                  selected ? 'text-ink' : 'text-ink-muted hover:text-ink'
                }`}
              >
                <Led on={!!indicators[tab.id]} />
                {tab.label}
                {selected && (
                  <motion.span
                    layoutId={`${id}-underline`}
                    className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-led shadow-[0_0_8px_var(--led)]"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
              </button>
            );
          })}
        </div>
        {actions && <div className="hidden shrink-0 pb-1.5 sm:block">{actions}</div>}
      </div>

      {/* Fixed height on wide screens so the keyboard below never jumps between pages */}
      <div className="pt-5 xl:min-h-[10.5rem]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active}
            id={`${id}-panel-${active}`}
            role="tabpanel"
            aria-labelledby={`${id}-tab-${active}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {panels[active]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
