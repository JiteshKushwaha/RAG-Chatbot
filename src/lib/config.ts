export const config = {
  primaryModel: process.env.LLM_MODEL || "openai/gpt-oss-120b",
  fallbackModel: process.env.LLM_FALLBACK_MODEL || "openai/gpt-oss-20b",
  llmBaseUrl: process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1",
  hfUrl:
    "https://router.huggingface.co/hf-inference/models/BAAI/bge-base-en-v1.5/pipeline/feature-extraction",
  bgeQueryPrefix: "Represent this sentence for searching relevant passages: ",
  maxQuestionChars: 500,
  maxHistoryTurns: 6,
  maxTokens: 900,
  contextCharBudget: 14000,
  finalChunks: 7,
  candidatePool: 30,
  rateLimitPerMin: 12,
  refusal: "I couldn't find this in the provided constitutional documents.",
} as const;
export const getLlmKey = (): string | undefined => process.env.LLM_API_KEY || undefined;
export const getHfToken = (): string | undefined => process.env.HF_TOKEN || undefined;
