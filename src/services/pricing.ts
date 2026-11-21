export const MODEL_PRICING: Record<string, { promptPer1M: number; completionPer1M: number }> = {
  // Google Gemini
  "gemini-3-flash-preview": { promptPer1M: 0.10, completionPer1M: 0.40 },
  "gemini-3.8-flash": { promptPer1M: 0.10, completionPer1M: 0.40 },
  "gemini-2.5-flash": { promptPer1M: 0.10, completionPer1M: 0.40 },
  "gemini-2.5-pro": { promptPer1M: 1.25, completionPer1M: 5.00 },
  "gemini-2.0-flash": { promptPer1M: 0.10, completionPer1M: 0.40 },
  "gemini-1.5-flash": { promptPer1M: 0.075, completionPer1M: 0.30 },
  "gemini-1.5-pro": { promptPer1M: 1.25, completionPer1M: 5.00 },

  // OpenAI
  "gpt-4o-mini": { promptPer1M: 0.15, completionPer1M: 0.60 },
  "gpt-4o": { promptPer1M: 2.50, completionPer1M: 10.00 },
  "gpt-4-turbo": { promptPer1M: 10.00, completionPer1M: 30.00 },

  // Anthropic Claude
  "claude-3-5-sonnet-20241022": { promptPer1M: 3.00, completionPer1M: 15.00 },
  "claude-3-5-haiku-20241022": { promptPer1M: 0.80, completionPer1M: 4.00 },

  // Groq (Llama / Mixtral)
  "llama-3.3-70b-versatile": { promptPer1M: 0.59, completionPer1M: 0.79 },
  "llama-3.1-8b-instant": { promptPer1M: 0.05, completionPer1M: 0.08 },
  "deepseek-r1-distill-llama-70b": { promptPer1M: 0.59, completionPer1M: 0.79 },

  // DeepSeek Official
  "deepseek-chat": { promptPer1M: 0.14, completionPer1M: 0.28 },
  "deepseek-reasoner": { promptPer1M: 0.55, completionPer1M: 2.19 },

  // OpenRouter & Multi-Provider Cloud
  "anthropic/claude-3.7-sonnet": { promptPer1M: 3.00, completionPer1M: 15.00 },
  "deepseek/deepseek-r1": { promptPer1M: 0.55, completionPer1M: 2.19 },
  "meta-llama/llama-3.3-70b-instruct": { promptPer1M: 0.59, completionPer1M: 0.79 },
  "google/gemini-2.0-flash-001": { promptPer1M: 0.10, completionPer1M: 0.40 },

  // Mistral AI
  "mistral-large-latest": { promptPer1M: 2.00, completionPer1M: 6.00 },
  "mistral-small-latest": { promptPer1M: 0.20, completionPer1M: 0.60 },
  "codestral-latest": { promptPer1M: 0.30, completionPer1M: 0.90 },

  // xAI (Grok)
  "grok-2-latest": { promptPer1M: 2.00, completionPer1M: 10.00 },
  "grok-beta": { promptPer1M: 5.00, completionPer1M: 15.00 },

  // Cohere AI
  "command-r-plus-08-2024": { promptPer1M: 2.50, completionPer1M: 10.00 },
  "command-r-08-2024": { promptPer1M: 0.15, completionPer1M: 0.60 },

  // Perplexity AI
  "sonar": { promptPer1M: 1.00, completionPer1M: 1.00 },
  "sonar-pro": { promptPer1M: 3.00, completionPer1M: 15.00 },
  "sonar-reasoning": { promptPer1M: 1.00, completionPer1M: 5.00 },

  // Embeddings
  "text-embedding-004": { promptPer1M: 0.02, completionPer1M: 0.00 },
  "text-embedding-3-small": { promptPer1M: 0.02, completionPer1M: 0.00 },
};

export function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  const m = (model || "").toLowerCase();
  let pricing = MODEL_PRICING[model];

  if (!pricing) {
    if (m.startsWith("gemini")) pricing = MODEL_PRICING["gemini-2.0-flash"];
    else if (m.includes("mini")) pricing = MODEL_PRICING["gpt-4o-mini"];
    else if (m.startsWith("gpt-4")) pricing = MODEL_PRICING["gpt-4o"];
    else if (m.startsWith("claude")) pricing = MODEL_PRICING["claude-3-5-sonnet-20241022"];
    else if (m.startsWith("grok")) pricing = MODEL_PRICING["grok-2-latest"];
    else if (m.startsWith("mistral")) pricing = MODEL_PRICING["mistral-small-latest"];
    else if (m.startsWith("sonar")) pricing = MODEL_PRICING["sonar"];
    else if (m.startsWith("command")) pricing = MODEL_PRICING["command-r-08-2024"];
    else if (m.includes("llama-3.3") || m.includes("70b")) pricing = MODEL_PRICING["llama-3.3-70b-versatile"];
    else pricing = { promptPer1M: 0, completionPer1M: 0 }; // Ollama/local
  }

  const promptCost = (promptTokens / 1_000_000) * pricing.promptPer1M;
  const completionCost = (completionTokens / 1_000_000) * pricing.completionPer1M;
  return Number((promptCost + completionCost).toFixed(6));
}

const keyRotationIndex: Record<string, number> = {};

export function getRotatedKey(providerId: string, primaryKey?: string, keysList?: string[]): string {
  const allKeys: string[] = [];
  if (primaryKey && primaryKey.trim()) {
    allKeys.push(...primaryKey.split(",").map(k => k.trim()).filter(Boolean));
  }
  if (keysList && Array.isArray(keysList)) {
    allKeys.push(...keysList.map(k => k.trim()).filter(Boolean));
  }
  const uniqueKeys = Array.from(new Set(allKeys));
  if (uniqueKeys.length === 0) return "";
  if (uniqueKeys.length === 1) return uniqueKeys[0];

  const currentIdx = keyRotationIndex[providerId] || 0;
  const selectedKey = uniqueKeys[currentIdx % uniqueKeys.length];
  keyRotationIndex[providerId] = (currentIdx + 1) % uniqueKeys.length;
  return selectedKey;
}
