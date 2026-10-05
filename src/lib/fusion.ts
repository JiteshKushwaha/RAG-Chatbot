// LEARNING NOTE: Reciprocal Rank Fusion merges ranked lists using only *ranks*, so BM25
// scores (unbounded) and cosine scores (−1..1) never need calibrating against each other.
export function rrf(lists: { index: number }[][], k = 60): Map<number, number> {
    const scores = new Map<number, number>();
    for (const list of lists) {
      list.forEach((item, rank) => {
        scores.set(item.index, (scores.get(item.index) ?? 0) + 1 / (k + rank + 1));
      });
    }
    return scores;
  }
  
  export function jaccard(a: Set<string>, b: Set<string>): number {
    let inter = 0;
    for (const x of a) if (b.has(x)) inter++;
    return inter / Math.max(1, a.size + b.size - inter);
}  