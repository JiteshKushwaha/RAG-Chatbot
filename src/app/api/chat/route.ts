import { NextRequest } from "next/server";
import { config, getLlmKey } from "@/lib/config";
import { checkGrounding } from "@/lib/grounding";
import { complete, LlmError, openStream, readDeltas } from "@/lib/groq";
import { getIndex } from "@/lib/loadIndex";
import { messagesFor, plan } from "@/lib/pipeline";
import { rateLimit } from "@/lib/rateLimit";
import { sseEncode } from "@/lib/sse";
import type { ChatTurn, DoneEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

const json = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function parseBody(raw: unknown): { question: string; messages: ChatTurn[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as { question?: unknown; messages?: unknown };
  if (typeof b.question !== "string") return null;
  const messages = Array.isArray(b.messages)
    ? b.messages
        .filter(
          (m): m is ChatTurn =>
            !!m &&
            typeof m === "object" &&
            ((m as ChatTurn).role === "user" || (m as ChatTurn).role === "assistant") &&
            typeof (m as ChatTurn).content === "string",
        )
        .slice(-config.maxHistoryTurns)
    : [];
  return { question: b.question, messages };
}

export async function POST(req: NextRequest): Promise<Response> {
  const t0 = Date.now();
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (!rateLimit(ip, config.rateLimitPerMin))
    return json(429, "Too many questions — please wait a minute.");

  let body: ReturnType<typeof parseBody>;
  try {
    body = parseBody(await req.json());
  } catch (err) {
    console.error("GROQ CHAT ROUTE ERROR:", err); // <-- ADD THIS LINE
    // existing error streaming logic returning "The language model is unavailable right now."
    // BEFORE:
    console.error("[chat] error: The language model is unavailable right now.");

    // AFTER:
    console.error("[chat] error DETAILS:", err);
    body = null;
  }
  if (!body) return json(400, "Invalid request.");
  const q = body.question.trim();
  if (!q) return json(400, "Please type a question.");
  if (q.length > config.maxQuestionChars)
    return json(400, `Questions are limited to ${config.maxQuestionChars} characters.`);

  let index;
  try {
    index = getIndex();
  } catch (e) {
    console.error("[chat] index load failed:", (e as Error).message);
    return json(500, "The document index is not available on the server.");
  }

  const p = await plan(index, q, body.messages);
  if (!p.canned && !getLlmKey()) return json(500, "Server misconfigured: GROQ_API_KEY is not set.");

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: string, d: unknown) => controller.enqueue(enc.encode(sseEncode(e, d)));
      const log = (model: string | null, extra: Record<string, unknown> = {}) =>
        console.log(
          JSON.stringify({
            q: p.question.slice(0, 200),
            articles: p.retrieval.detectedArticles,
            confidence: p.retrieval.confidence,
            mode: p.retrieval.mode,
            chunks: p.retrieval.chunks.map((c) => c.chunk.id),
            model,
            ms: Date.now() - t0,
            ...extra,
          }),
        );
      try {
        send("stage", { stage: "searching" });
        if (p.retrieval.detectedArticles.length)
          send("stage", { stage: "reading", articles: p.retrieval.detectedArticles });
        if (p.canned) {
          send("meta", p.meta);
          send("token", { t: p.canned });
          const done: DoneEvent = {
            grounding: null,
            finalText: p.canned,
            latencyMs: Date.now() - t0,
          };
          send("done", done);
          log(null, { kind: p.meta.kind });
          controller.close();
          return;
        }
        send("stage", { stage: "composing" });
        const { res, model } = await openStream(messagesFor(p, body.messages), req.signal);
        send("meta", { ...p.meta, model });
        let text = "";
        for await (const d of readDeltas(res)) {
          text += d;
          send("token", { t: d });
        }
        let g = checkGrounding(text, p.retrieval.chunks);
        // One stricter regeneration when unverifiable quotes/articles were produced.
        if (
          !g.report.verified &&
          (g.report.unverifiedQuotes.length || g.report.unknownArticles.length)
        ) {
          try {
            const retry = await complete(messagesFor(p, body.messages, true), req.signal);
            const g2 = checkGrounding(retry.text, p.retrieval.chunks);
            if (g2.report.verified) g = g2;
          } catch {
            /* keep first answer + warning */
          }
        }
        const done: DoneEvent = {
          grounding: g.report,
          finalText: g.text,
          latencyMs: Date.now() - t0,
        };
        send("done", done);
        log(model, { verified: g.report.verified });
      } catch (e) {
        if (req.signal.aborted) return controller.close();
        const msg = e instanceof LlmError ? e.message : "Something went wrong while answering.";
        send("error", { error: msg, status: e instanceof LlmError ? e.status : 502 });
        console.error("[chat] error:", (e as Error).message);
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });
}
