import { config } from "./config";
import type { Index } from "./loadIndex";
import { buildMessages } from "./prompt";
import { rewriteFollowUp } from "./queryRewrite";
import { retrieve, sanitizeQuestion } from "./retrieve";
import type { ChatTurn, MetaEvent, RetrievalResult, Source } from "./types";

export const CANNED = {
  greeting:
    "Namaste! I answer questions about the **Constitution of India** using only the documents I was given — try *“What is Article 21?”* or *“Who can amend the Constitution?”*. I'll always show where each answer came from.",
  offtopic:
    "That's outside what I can help with. I only answer questions about the **Constitution of India** from the documents I was given.",
  injection:
    "I can't change my rules or share my internal instructions. I'm happy to answer a question about the Constitution of India, though.",
};

export interface Plan {
  question: string;
  retrieval: RetrievalResult;
  meta: MetaEvent;
  canned: string | null; // when set, no LLM call is made
}

export function toSources(r: RetrievalResult): Source[] {
  return r.chunks.map((s, i) => ({
    n: i + 1,
    book: s.chunk.book_title,
    pdfPage: s.chunk.pdf_page,
    printedPage: s.chunk.printed_page,
    part: s.chunk.part,
    article: s.chunk.article_numbers[0] ?? null,
    articleTitle: s.chunk.article_title,
    snippet: s.chunk.text,
    score: Math.round(Math.min(1, s.pinned ? 1 : s.score * 20) * 100) / 100,
  }));
}

export async function plan(index: Index, rawQuestion: string, history: ChatTurn[]): Promise<Plan> {
  const question = rewriteFollowUp(sanitizeQuestion(rawQuestion), history);
  const retrieval = await retrieve(index, question);
  const sources = toSources(retrieval);
  const base = {
    confidence: retrieval.confidence,
    mode: retrieval.mode,
    detectedArticles: retrieval.detectedArticles,
    model: null,
  };
  if (retrieval.intent === "greeting" || retrieval.intent === "injection") {
    return { question, retrieval, canned: CANNED[retrieval.intent], meta: { ...base, sources: [], kind: "canned" } };
  }
  // LEARNING NOTE: the cheapest hallucination is the one never generated. Low evidence → no LLM.
  if (retrieval.confidence === "low") {
    const msg = retrieval.intent === "offtopic" ? CANNED.offtopic : config.refusal;
    return {
      question,
      retrieval,
      canned: msg,
      meta: { ...base, sources: retrieval.intent === "offtopic" ? [] : sources.slice(0, 3), kind: "refusal" },
    };
  }
  return { question, retrieval, canned: null, meta: { ...base, sources, kind: "answer" } };
}

export function messagesFor(p: Plan, history: ChatTurn[], strict = false) {
  return buildMessages(p.question, p.retrieval.chunks, {
    pureArticle: p.retrieval.pureArticle,
    strict,
    history,
  });
}