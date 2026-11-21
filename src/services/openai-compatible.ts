import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
} from "../types.js";

export async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  request: ChatCompletionRequest,
  extraHeaders?: Record<string, string>
): Promise<ChatCompletionResponse> {
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI-compatible provider error (${res.status}): ${errText}`);
  }

  return (await res.json()) as ChatCompletionResponse;
}

export async function* streamOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  request: ChatCompletionRequest,
  extraHeaders?: Record<string, string>
): AsyncGenerator<{ chunk: string; text?: string }> {
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...request, stream: true }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok || !res.body) {
    const errText = await res.text();
    throw new Error(`OpenAI-compatible stream error (${res.status}): ${errText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        let extractedText: string | undefined;
        if (trimmed.startsWith("data: ") && !trimmed.includes("[DONE]")) {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            extractedText = parsed.choices?.[0]?.delta?.content;
          } catch { }
        }
        yield { chunk: `${trimmed}\n\n`, text: extractedText };
      }
    }
  }

  if (buffer.trim()) {
    yield { chunk: `${buffer.trim()}\n\n` };
  }
}
