import { db } from "../db.js";

export interface EmbeddingsRequest {
  model: string;
  input: string | string[];
}

export interface EmbeddingsResponse {
  object: "list";
  data: Array<{
    object: "embedding";
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export async function createEmbeddings(req: EmbeddingsRequest): Promise<EmbeddingsResponse> {
  const inputs = Array.isArray(req.input) ? req.input : [req.input];
  const providers = db.getProviders();
  const model = req.model || "text-embedding-004";

  // 1. Google Gemini Embeddings
  if (model.includes("embedding-004") || model.startsWith("gemini")) {
    const config = providers.gemini;
    if (!config?.apiKey) {
      throw new Error("Gemini API key is not configured for embeddings.");
    }
    const targetModel = "text-embedding-004";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:batchEmbedContents?key=${config.apiKey}`;

    const requests = inputs.map(text => ({
      model: `models/${targetModel}`,
      content: { parts: [{ text }] },
    }));

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requests }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini embeddings error (${res.status}): ${err}`);
    }

    const data = (await res.json()) as any;
    const embeddings = (data.embeddings || []).map((e: any, idx: number) => ({
      object: "embedding" as const,
      embedding: e.values || [],
      index: idx,
    }));

    const estTokens = inputs.reduce((acc, str) => acc + Math.ceil(str.length / 4), 0);

    return {
      object: "list",
      data: embeddings,
      model: targetModel,
      usage: {
        prompt_tokens: estTokens,
        total_tokens: estTokens,
      },
    };
  }

  // 2. OpenAI Embeddings
  if (model.startsWith("text-embedding") || model.includes("openai")) {
    const config = providers.openai;
    if (!config?.apiKey) {
      throw new Error("OpenAI API key is not configured for embeddings.");
    }
    const url = "https://api.openai.com/v1/embeddings";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: req.model || "text-embedding-3-small",
        input: req.input,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI embeddings error (${res.status}): ${err}`);
    }

    return (await res.json()) as EmbeddingsResponse;
  }

  // 3. Ollama Embeddings fallback
  const ollamaConfig = providers.ollama;
  const ollamaUrl = (ollamaConfig?.baseUrl || "http://localhost:11434").replace(/\/+$/, "") + "/v1/embeddings";
  const res = await fetch(ollamaUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: req.model || "nomic-embed-text",
      input: req.input,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama embeddings error (${res.status}): ${err}`);
  }

  return (await res.json()) as EmbeddingsResponse;
}
