// import { config, getGroqKey } from "./config";
import { config, getLlmKey } from "./config";

export class LlmError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

type Msg = { role: "system" | "user" | "assistant"; content: string };

async function open(model: string, messages: Msg[], signal?: AbortSignal): Promise<Response> {
  const key = getLlmKey();
  if (!key) throw new LlmError("Server is missing GROQ_API_KEY.", 500);
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0,
    top_p: 0.1,
    max_completion_tokens: config.maxTokens,
    stream: true,
  };
  // gpt-oss models are reasoning models: keep reasoning short and out of the answer stream.
  if (model.startsWith("openai/gpt-oss")) {
    body.reasoning_effort = "low";
    body.include_reasoning = false;
  }
  return fetch(`${config.llmBaseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Opens a stream with retry → fallback model. Returns the model actually used. */
export async function openStream(
  messages: Msg[],
  signal?: AbortSignal,
): Promise<{ res: Response; model: string }> {
  const attempts = [config.primaryModel, config.fallbackModel];
  let last = 0;

  for (let i = 0; i < attempts.length; i++) {
    const res = await open(attempts[i], messages, signal);

    if (res.ok && res.body) {
      return { res, model: attempts[i] };
    }

    last = res.status;

    const retryable =
      res.status === 429 || res.status >= 500 || res.status === 404 || res.status === 400;

    if (!retryable) break;

    if (i === 0) await sleep(800);
  }

  throw new LlmError(
    last === 429
      ? "The language model is busy (rate limited). Please try again shortly."
      : "The language model is unavailable right now.",
    last === 429 ? 429 : 502,
  );
}

/** Parses OpenAI-compatible SSE into content deltas. */
export async function* readDeltas(res: Response): AsyncGenerator<string> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const j = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
        const d = j.choices?.[0]?.delta?.content;
        if (d) yield d;
      } catch {
        /* partial line — ignore */
      }
    }
  }
}
export async function complete(
  messages: Msg[],
  signal?: AbortSignal,
): Promise<{ text: string; model: string }> {
  const { res, model } = await openStream(messages, signal);
  let text = "";
  for await (const d of readDeltas(res)) text += d;
  return { text, model };
}
