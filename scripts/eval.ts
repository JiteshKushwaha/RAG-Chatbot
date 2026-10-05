/* npm run eval        → retrieval + refusal metrics (no LLM, free)
   npm run eval:llm    → also generates answers and measures grounding-flag rate (needs LLM_API_KEY) */
import fs from "node:fs";
import path from "node:path";
import { checkGrounding } from "../src/lib/grounding";
import { complete } from "../src/lib/groq";
import { getIndex } from "../src/lib/loadIndex";
import { messagesFor, plan } from "../src/lib/pipeline";

interface Q {
  q: string;
  articles?: string[];
  keywords?: string[];
  refuse?: boolean;
}

async function main() {
  const useLlm = process.argv.includes("--llm");
  const qs = JSON.parse(
    fs.readFileSync(path.join("ingestion", "eval_questions.json"), "utf-8"),
  ) as Q[];
  const index = getIndex();
  let hit = 0,
    pos = 0,
    refuseOk = 0,
    neg = 0,
    flagged = 0,
    generated = 0;
  for (const item of qs) {
    const p = await plan(index, item.q, []);
    const refused = p.canned !== null;
    let ok: boolean;
    if (item.refuse) {
      neg++;
      ok = refused;
      if (ok) refuseOk++;
    } else {
      pos++;
      const arts = new Set(
        p.retrieval.chunks.flatMap((c) => [...c.chunk.article_numbers, ...c.chunk.mentions]),
      );
      const text = p.retrieval.chunks.map((c) => c.chunk.text.toLowerCase()).join(" ");
      ok =
        !refused &&
        ((item.articles ?? []).some((a) => arts.has(a)) ||
          (item.keywords ?? []).some((k) => text.includes(k.toLowerCase())));
      if (ok) hit++;
      if (useLlm && !refused) {
        const { text: ans } = await complete(messagesFor(p, []));
        generated++;
        if (!checkGrounding(ans, p.retrieval.chunks).report.verified) flagged++;
      }
    }
    console.log(`${ok ? "PASS" : "FAIL"}  [${p.retrieval.confidence.padEnd(6)}] ${item.q}`);
  }
  console.log("\n──────── metrics ────────");
  console.log(`retrieval hit-rate@${7}: ${((100 * hit) / pos).toFixed(1)}%   (target ≥ 90%)`);
  console.log(`refusal accuracy:       ${((100 * refuseOk) / neg).toFixed(1)}%   (target 100%)`);
  if (useLlm)
    console.log(
      `grounding-flag rate:    ${((100 * flagged) / Math.max(1, generated)).toFixed(1)}%   (target ≤ 10%)`,
    );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
