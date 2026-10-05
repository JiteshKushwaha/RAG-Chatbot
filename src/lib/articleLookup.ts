import type { Index } from "./loadIndex";

export function normalizeArticle(a: string): string {
  return a.trim().toUpperCase().replace(/\s+/g, "");
}

/** Returns chunk positions (in index.chunks) for an exact Article number, in document order. */
export function lookupArticle(index: Index, article: string): number[] {
  const ids = index.articleIndex[normalizeArticle(article)] ?? [];
  return ids.map((id) => index.byId.get(id)).filter((x): x is number => x !== undefined);

}