import { tokenize } from "./tokenize";

// LEARNING NOTE: BM25 is keyword search with length normalisation. It is excellent for
// legal text where exact words ("habeas corpus", "Article 21") matter, and it needs no model.
export class BM25 {
  private docs: Map<string, number>[] = [];
  private lengths: number[] = [];
  private df = new Map<string, number>();
  private avgdl = 0;
  constructor(
    private k1 = 1.5,
    private b = 0.75,
  ) {}

  build(texts: string[]): this {
    for (const t of texts) {
      const tf = new Map<string, number>();
      const toks = tokenize(t);
      for (const tok of toks) tf.set(tok, (tf.get(tok) ?? 0) + 1);
      for (const tok of tf.keys()) this.df.set(tok, (this.df.get(tok) ?? 0) + 1);
      this.docs.push(tf);
      this.lengths.push(toks.length);
    }
    this.avgdl = this.lengths.reduce((a, b) => a + b, 0) / Math.max(1, this.lengths.length);
    return this;
  }

  idf(term: string): number {
    const n = this.docs.length;
    const df = this.df.get(term) ?? 0;
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }

  search(query: string, k: number): { index: number; score: number }[] {
    const terms = [...new Set(tokenize(query))];
    const out: { index: number; score: number }[] = [];
    for (let i = 0; i < this.docs.length; i++) {
      const tf = this.docs[i];
      let s = 0;
      for (const term of terms) {
        const f = tf.get(term);
        if (!f) continue;
        const norm = f + this.k1 * (1 - this.b + (this.b * this.lengths[i]) / this.avgdl);
        s += this.idf(term) * ((f * (this.k1 + 1)) / norm);
      }
      if (s > 0) out.push({ index: i, score: s });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, k);
  }

  /** Max achievable score if a doc contained every query term once — used for confidence. */
  idealScore(query: string): number {
    return [...new Set(tokenize(query))].reduce((s, t) => s + this.idf(t) * (this.k1 + 1) * 0.5, 0);
  }
}