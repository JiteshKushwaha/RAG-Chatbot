import { describe, expect, it } from "vitest";
import { checkGrounding, quoteSupport } from "../src/lib/grounding";
import { chunks } from "./fixtures";

const ctx = [{ chunk: chunks[1], score: 1, pinned: true }];

describe("grounding", () => {
  it("accepts verbatim quotes", () => {
    const r = checkGrounding('Article 21 says: "No person shall be deprived of his life or personal liberty except according to procedure established by law." [1]', ctx);
    expect(r.report.verified).toBe(true);
  });
  it("flags the notebook's hallucinated Article 21", () => {
    const r = checkGrounding('"State shall not make any law which abrogates or subverts any provisions of this Part, namely Chapter IV" [1]', ctx);
    expect(r.report.verified).toBe(false);
    expect(r.report.unverifiedQuotes.length).toBe(1);
  });
  it("strips invalid citations and unknown articles", () => {
    const r = checkGrounding("See Article 999 [7].", ctx);
    expect(r.text).not.toContain("[7]");
    expect(r.report.invalidCitations).toEqual([7]);
    expect(r.report.unknownArticles).toEqual(["999"]);
  });
  it("fuzzy support tolerates punctuation", () => {
    expect(quoteSupport("No person shall be deprived of his life, or personal liberty", chunks[1].text)).toBeGreaterThan(0.6);
  });
});