import type { GroundingReport, ScoredChunk } from "./types";

const norm = (s: string) =>
  s.toLowerCase().normalize("NFKC").replace(/[“”"'‘’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function trigrams(words: string[]): string[] {
  if (words.length < 3) return [words.join(" ")];
  const out: string[] = [];
  for (let i = 0; i + 2 < words.length; i++) out.push(words.slice(i, i + 3).join(" "));
  return out;
}

/** Fuzzy containment: share of the quote's word-trigrams present in the context. */
export function quoteSupport(quote: string, context: string): number {
  const q = norm(quote);
  const c = norm(context);
  if (!q) return 1;
  if (c.includes(q)) return 1;
  const grams = trigrams(q.split(" "));
  return grams.filter((g) => c.includes(g)).length / grams.length;
}

export function extractQuotes(answer: string): string[] {
  const quotes: string[] = [];
  for (const m of answer.matchAll(/["“]([^"”]{20,})["”]/g)) quotes.push(m[1]);
  const block = answer
    .split("\n")
    .filter((l) => l.trim().startsWith(">"))
    .map((l) => l.replace(/^\s*>\s?/, "").replace(/\[\d+\]/g, "").trim())
    .join(" ");
  if (block.length >= 20) quotes.push(block);
  return quotes;
}

/** Strips invalid [n] markers; returns cleaned text + invalid ones. */
export function enforceCitations(answer: string, n: number): { text: string; invalid: number[] } {
  const invalid: number[] = [];
  const text = answer.replace(/\[(\d{1,2})\]/g, (m, d: string) => {
    const k = Number(d);
    if (k >= 1 && k <= n) return m;
    invalid.push(k);
    return "";
  });
  return { text, invalid };
}

export function checkGrounding(answer: string, chunks: ScoredChunk[]): { text: string; report: GroundingReport } {
  const { text, invalid } = enforceCitations(answer, chunks.length);
  const context = chunks.map((c) => c.chunk.text).join("\n");
  const known = new Set(chunks.flatMap((c) => [...c.chunk.article_numbers, ...c.chunk.mentions]));
  // LEARNING NOTE: we verify the *checkable* parts of an answer — verbatim quotes and Article
  // numbers. Anything the model quotes must literally exist in what we retrieved.
  const unverifiedQuotes = extractQuotes(text).filter((q) => quoteSupport(q, context) < 0.9);
  const unknownArticles = [...text.matchAll(/\bArticles?\s+(\d{1,3}[A-Z]{0,3})\b/gi)]
    .map((m) => m[1].toUpperCase())
    .filter((a, i, arr) => arr.indexOf(a) === i)
    .filter((a) => !known.has(a) && !new RegExp(`\\b${a}\\b`, "i").test(context));
  return {
    text,
    report: {
      verified: !unverifiedQuotes.length && !unknownArticles.length && !invalid.length,
      unverifiedQuotes,
      unknownArticles,
      invalidCitations: invalid,
    },
  };

}