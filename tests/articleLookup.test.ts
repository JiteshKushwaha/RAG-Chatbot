import { describe, expect, it } from "vitest";
import { lookupArticle } from "../src/lib/articleLookup";
import { index } from "./fixtures";
describe("article lookup", () => {
  const idx = index();
  it("finds 21, 21A, 32 exactly", () => {
    expect(idx.chunks[lookupArticle(idx, "21")[0]].text).toMatch(/^21\. Protection of life/);
    expect(idx.chunks[lookupArticle(idx, "21a")[0]].text).toMatch(/^21A\. Right to education/);
    expect(idx.chunks[lookupArticle(idx, "32")[0]].text).toMatch(/Supreme Court/);
  });
  it("returns empty for unknown", () => expect(lookupArticle(idx, "9999")).toEqual([]));
});