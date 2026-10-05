import { Squiggle } from "./Chakra";

export const SUGGESTIONS = [
  "What is Article 14?",
  "What is Article 21?",
  "What are Fundamental Rights?",
  "Who can amend the Constitution?",
  "Explain the Directive Principles of State Policy.",
  "What writs can be issued under Article 32?",
];

export function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <section className="flex flex-col items-center text-center pt-[12vh] pb-10 px-4" aria-label="Get started">
      <h1 className="text-4xl sm:text-6xl font-semibold tracking-[-0.035em]">Ask the Constitution.</h1>
      <Squiggle className="w-56 h-3 mt-2" />
      <p className="font-hand text-accent text-xl mt-3 -rotate-1">(not a lawyer, just a library ✎)</p>
      <p className="font-serif text-muted mt-2" lang="hi">भारत का संविधान</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-10 w-full max-w-3xl">
        {SUGGESTIONS.map((s, i) => (
          <button key={s} onClick={() => onPick(s)} className="sketch-card text-left" style={{ ["--r" as string]: `${(i % 3) - 1}deg` }}>
            <span className="text-[15px]">{s}</span>
          </button>
        ))}
      </div>
    </section>
  );
}