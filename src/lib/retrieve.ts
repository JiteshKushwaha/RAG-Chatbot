import { config } from "./config";
import { lookupArticle } from "./articleLookup";
import { denseSearch, embedQuery } from "./dense";
import { jaccard, rrf } from "./fusion";
import type { Index } from "./loadIndex";
import {
  classifyIntent,
  expandQuery,
  extractArticles,
  isPureArticleQuestion,
} from "./queryRewrite";
import { tokenize } from "./tokenize";
import type { Confidence, RetrievalResult, ScoredChunk } from "./types";

export function sanitizeQuestion(raw: string): string {
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

function coverage(query: string, text: string): number {
  const q = new Set(tokenize(query));
  if (!q.size) return 0;
  const t = new Set(tokenize(text));
  let hit = 0;
  for (const x of q) if (t.has(x)) hit++;
  return hit / q.size;
}

export async function retrieve(index: Index, question: string): Promise<RetrievalResult> {
  const intent = classifyIntent(question);
  const detectedArticles = extractArticles(question);
  const base = { detectedArticles, intent, query: question, pureArticle: false };

  if (intent === "greeting" || intent === "injection") {
    return { ...base, chunks: [], confidence: "low", mode: "bm25" };
  }

  // 1) Exact article lookup → pinned chunks (fixes the Article 21 / 32 hallucinations)
  const pinnedIdx: number[] = [];
  for (const a of detectedArticles) pinnedIdx.push(...lookupArticle(index, a).slice(0, 3));
  const exactHit = pinnedIdx.length > 0;

  // 2) Query expansion + hint articles (soft boost, not pinned)
  const { expanded, hintArticles } = expandQuery(question);
  const hintIdx = new Set<number>();
  if (!detectedArticles.length) for (const a of hintArticles) lookupArticle(index, a).slice(0, 1).forEach((i) => hintIdx.add(i));

  // 3) Hybrid search
  const bm = index.bm25.search(expanded, config.candidatePool);
  let mode: "hybrid" | "bm25" = "bm25";
  let dense: { index: number; score: number }[] = [];
  if (index.vectors) {
    const qv = await embedQuery(question, index.dim);
    if (qv) {
      dense = denseSearch(index, qv, config.candidatePool);
      mode = "hybrid";
    }
  }
  const lists = [bm, ...(dense.length ? [dense] : []), [...hintIdx].map((index) => ({ index }))];
  const fused = rrf(lists);

  // 4) Rerank: fused score + lexical overlap; then MMR-style dedupe
  const ranked = [...fused.entries()]
    .map(([i, s]) => ({ i, s: s + 0.02 * coverage(expanded, index.chunks[i].search_text) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 12);

  const selected: ScoredChunk[] = [];
  const seenTok: Set<string>[] = [];
  let budget = config.contextCharBudget;
  const push = (i: number, score: number, pinned: boolean): void => {
    const chunk = index.chunks[i];
    if (selected.some((s) => s.chunk.id === chunk.id) || chunk.text.length > budget) return;
    const toks = new Set(tokenize(chunk.text));
    if (!pinned && seenTok.some((t) => jaccard(t, toks) > 0.8)) return;
    selected.push({ chunk, score, pinned });
    seenTok.push(toks);
    budget -= chunk.text.length;
  };
  pinnedIdx.forEach((i) => push(i, 1, true));
  for (const r of ranked) {
    if (selected.length >= config.finalChunks) break;
    if (index.chunks[r.i].section_type === "toc" && selected.length > 2) continue;
    push(r.i, r.s, false);
  }

  // 5) Confidence
  const top = selected.find((s) => !s.pinned) ?? selected[0];
  const cov = top ? coverage(question, top.chunk.search_text) : 0;
  const bmRatio = bm.length ? bm[0].score / Math.max(1e-6, index.bm25.idealScore(question)) : 0;
  let confidence: Confidence = "low";
  if (exactHit) confidence = "high";
  else if (detectedArticles.length) confidence = "low"; // named an Article that doesn't exist (e.g. 9999)
  else if (intent === "offtopic") confidence = cov >= 0.8 && bmRatio > 0.6 ? "medium" : "low";
  else if (hintIdx.size && cov >= 0.3) confidence = "high";
  else if (cov >= 0.6 && bmRatio > 0.35) confidence = "high";
  else if (cov >= 0.4 && bmRatio > 0.2) confidence = "medium";

  return {
    ...base,
    chunks: selected,
    confidence,
    mode,
    pureArticle: exactHit && isPureArticleQuestion(question),
  };
}