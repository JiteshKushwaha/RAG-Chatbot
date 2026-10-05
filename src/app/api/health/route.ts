// import { getGroqKey, getHfToken, config } from "@/lib/config";
import { getLlmKey, getHfToken, config } from "@/lib/config";
import { getIndex } from "@/lib/loadIndex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const idx = getIndex();
    return Response.json({
      ok: true,
      mode: idx.vectors && getHfToken() ? "hybrid" : "bm25",
      chunks: idx.chunks.length,
      articles: Object.keys(idx.articleIndex).length,
      embeddings: !!idx.vectors,
      // llmConfigured: !!getGroqKey(),
      llmConfigured: !!getLlmKey(),
      models: { primary: config.primaryModel, fallback: config.fallbackModel },
      manifest: idx.manifest,
    });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
