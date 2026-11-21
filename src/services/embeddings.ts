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
  isFallback?: boolean;
}

async function tryGeminiEmbeddings(inputs: string[], apiKey: string): Promise<EmbeddingsResponse> {
  const targetModel = "text-embedding-004";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:batchEmbedContents?key=${apiKey}`;

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

async function tryOpenAIEmbeddings(inputs: string | string[], apiKey: string, modelName: string = "text-embedding-3-small"): Promise<EmbeddingsResponse> {
  const url = "https://api.openai.com/v1/embeddings";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      input: inputs,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embeddings error (${res.status}): ${err}`);
  }

  return (await res.json()) as EmbeddingsResponse;
}

async function tryOllamaEmbeddings(inputs: string | string[], baseUrl: string, modelName: string = "nomic-embed-text"): Promise<EmbeddingsResponse> {
  const ollamaUrl = baseUrl.replace(/\/+$/, "") + "/v1/embeddings";
  const res = await fetch(ollamaUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelName,
      input: inputs,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama embeddings error (${res.status}): ${err}`);
  }

  return (await res.json()) as EmbeddingsResponse;
}

export async function createEmbeddings(req: EmbeddingsRequest): Promise<EmbeddingsResponse> {
  const inputs = Array.isArray(req.input) ? req.input : [req.input];
  const providers = db.getProviders();
  const rawModel = (req.model || "").toLowerCase();

  const errors: string[] = [];

  // Plan sequence of fallback providers
  const isGeminiFirst = rawModel.includes("embedding-004") || rawModel.startsWith("gemini") || !rawModel.startsWith("text-embedding-3");

  if (isGeminiFirst) {
    // 1. Try Gemini
    if (providers.gemini?.apiKey) {
      try {
        return await tryGeminiEmbeddings(inputs, providers.gemini.apiKey);
      } catch (e: any) {
        errors.push(`Gemini: ${e.message}`);
      }
    }

    // 2. Fallback to OpenAI
    if (providers.openai?.apiKey) {
      try {
        const resp = await tryOpenAIEmbeddings(req.input, providers.openai.apiKey, "text-embedding-3-small");
        return { ...resp, isFallback: true };
      } catch (e: any) {
        errors.push(`OpenAI Fallback: ${e.message}`);
      }
    }
  } else {
    // 1. Try OpenAI
    if (providers.openai?.apiKey) {
      try {
        return await tryOpenAIEmbeddings(req.input, providers.openai.apiKey, req.model || "text-embedding-3-small");
      } catch (e: any) {
        errors.push(`OpenAI: ${e.message}`);
      }
    }

    // 2. Fallback to Gemini
    if (providers.gemini?.apiKey) {
      try {
        const resp = await tryGeminiEmbeddings(inputs, providers.gemini.apiKey);
        return { ...resp, isFallback: true };
      } catch (e: any) {
        errors.push(`Gemini Fallback: ${e.message}`);
      }
    }
  }

  // 3. Fallback to Ollama Local Embeddings
  const ollamaUrls = [
    providers.ollama?.baseUrl || "http://localhost:11434",
    "http://host.docker.internal:11434",
    "http://172.17.0.1:11434"
  ];
  for (const oUrl of ollamaUrls) {
    try {
      const resp = await tryOllamaEmbeddings(req.input, oUrl, "nomic-embed-text");
      return { ...resp, isFallback: true };
    } catch { }
  }

  throw new Error(`All embeddings providers exhausted. Attempted fallbacks: ${errors.join(" | ") || "No active API keys configured for Gemini, OpenAI or Ollama"}`);
}
