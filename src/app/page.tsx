import PianoApp from "@/components/PianoApp";

const REPO_URL = "https://github.com/satyaidk/expert-eureka";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[1480px] flex-1 flex-col gap-6 px-3 pb-12 pt-6 sm:px-6 sm:pt-8">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 px-1">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight [font-stretch:90%]">
            Keyboard Piano
          </h1>
          <p className="mt-1.5 text-base leading-relaxed text-ink-muted">
            A 37-key digital piano for your computer keyboard. Every note is synthesized live in your browser.
          </p>
        </div>
        <a
          href={REPO_URL}
          className="text-sm text-ink-muted underline decoration-white/20 underline-offset-4 transition-colors hover:text-ink hover:decoration-[var(--led)]"
        >
          Source code and docs
        </a>
      </header>

      <PianoApp />
    </main>
  );
}
