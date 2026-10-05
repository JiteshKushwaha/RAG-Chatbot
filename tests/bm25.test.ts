import { describe, expect, it } from "vitest";
import { BM25 } from "../src/lib/bm25";
describe("BM25", () => {
  const bm = new BM25().build(["equality before law", "life and personal liberty procedure", "writs habeas corpus supreme court"]);
  it("ranks the matching document first", () => {
    expect(bm.search("personal liberty", 3)[0].index).toBe(1);
    expect(bm.search("habeas corpus writs", 3)[0].index).toBe(2);
  });
  it("returns nothing for unrelated terms", () => {
    expect(bm.search("jupiter planet", 3)).toHaveLength(0);
  });
});