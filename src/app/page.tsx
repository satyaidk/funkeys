import PianoApp from "@/components/PianoApp";

/*
 * The page pads itself with the safe-area insets (notch, home indicator),
 * since the viewport extends under them (viewport-fit=cover in the layout).
 * On phones the keyboard is docked at the bottom and pads itself instead.
 */

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[1480px] flex-1 flex-col pb-[max(3rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))] dock:pb-0 sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] sm:pt-8">
      <PianoApp />
    </main>
  );
}
