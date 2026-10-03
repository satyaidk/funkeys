/**
 * @fileoverview A legend of which computer keys do what.
 */

import { Note } from '@/types';

interface KeyGuideProps {
  notes: Note[];
}

function Keys({ keys }: { keys: string }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {keys.split(' ').map((k) => (
        <kbd
          key={k}
          className="inline-flex h-6 min-w-6 items-center justify-center rounded-[5px] border border-white/10 bg-linear-to-b from-[#2e2a34] to-[#222027] px-1.5 font-sans text-[11px] text-ink shadow-[0_1px_0_rgb(0_0_0/0.6)]"
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}

export default function KeyGuide({ notes }: KeyGuideProps) {
  const lower = `${notes[0].id} to ${notes[16].id}`;
  const upper = `${notes[17].id} to ${notes[notes.length - 1].id}`;

  return (
    <section aria-label="Keyboard guide" className="grid gap-x-10 gap-y-5 text-sm text-ink-muted md:grid-cols-2 xl:grid-cols-[1fr_1fr_auto]">
      <div className="flex flex-col gap-2">
        <p>
          <span className="text-ink">Bottom two rows</span> play {lower}
        </p>
        <Keys keys="Z X C V B N M , . /" />
        <Keys keys="S D G H J L ;" />
      </div>
      <div className="flex flex-col gap-2">
        <p>
          <span className="text-ink">Top two rows</span> play {upper}
        </p>
        <Keys keys="Q W E R T Y U I O P [ ]" />
        <Keys keys="2 3 4 6 7 9 0 -" />
      </div>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
        <dt><Keys keys="← →" /></dt>
        <dd>Octave down / up</dd>
        <dt><Keys keys="↑ ↓" /></dt>
        <dd>Transpose</dd>
        <dt><Keys keys="Space" /></dt>
        <dd>Hold for sustain</dd>
        <dt><Keys keys="Shift" /></dt>
        <dd>Hold for soft pedal</dd>
      </dl>
    </section>
  );
}
