import PianoApp from "@/components/PianoApp";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[1480px] flex-1 flex-col px-3 pb-[max(3rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:px-6 sm:pt-8">
      <PianoApp />
    </main>
  );
}
