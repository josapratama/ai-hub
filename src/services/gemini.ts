import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChunk,
  ToolCall,
} from "../types.js";

async function parseMessageContentAsync(content: any): Promise<any[]> {
  if (typeof content === "string") {
    return [{ text: content }];
  }

  if (Array.isArray(content)) {
    const parts: any[] = [];
    for (const item of content) {
      if (item.type === "text" && item.text) {
        parts.push({ text: item.text });
      } else if (item.type === "image_url" && item.image_url?.url) {
        const url: string = item.image_url.url;
        const match = url.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          parts.push({
            inlineData: {
              mimeType: match[1],
              data: match[2],
            },
          });
        } else if (url.startsWith("http://") || url.startsWith("https://")) {
          try {
            const imgRes = await fetch(url);
            if (imgRes.ok) {
              const mimeType = imgRes.headers.get("content-type") || "image/jpeg";
              const arrayBuffer = await imgRes.arrayBuffer();
              const base64 = Buffer.from(arrayBuffer).toString("base64");
              parts.push({
                inlineData: {
                  mimeType,
                  data: base64,
                },
              });
            } else {
              parts.push({ text: `[Attached Image: ${url}]` });
            }
          } catch {
            parts.push({ text: `[Attached Image: ${url}]` });
          }
        } else {
          parts.push({ text: `[Attached Image: ${url}]` });
        }
      } else if (item.text) {
        parts.push({ text: item.text });
      }
    }
    return parts.length > 0 ? parts : [{ text: "" }];
  }

  return [{ text: String(content || "") }];
}

function convertToolsToGemini(tools?: any[]): any[] | undefined {
  if (!tools || !Array.isArray(tools) || tools.length === 0) return undefined;
  const functionDeclarations = tools
    .filter(t => t.type === "function" && t.function)
    .map(t => ({
      name: t.function.name,
      description: t.function.description || "",
      parameters: t.function.parameters,
    }));

  if (functionDeclarations.length === 0) return undefined;
  return [{ functionDeclarations }];
}

async function buildGeminiContents(messages: any[]): Promise<any[]> {
  return Promise.all(
    messages
      .filter(m => m.role !== "system")
      .map(async m => {
        if ((m.role as any) === "tool") {
          return {
            role: "function",
            parts: [
              {
                functionResponse: {
                  name: m.name || "function",
                  response: { content: m.content },
                },
              },
            ],
          };
        }
        if (m.role === "assistant" && m.tool_calls && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
          const parts: any[] = [];
          if (m.content) {
            parts.push({ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) });
          }
          for (const tc of m.tool_calls) {
            let args = {};
            try {
              args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments;
            } catch {
              args = {};
            }
            parts.push({
              functionCall: {
                name: tc.function.name,
                args,
              },
            });
          }
          return { role: "model", parts };
        }
        return {
          role: m.role === "assistant" ? "model" : "user",
          parts: await parseMessageContentAsync(m.content),
        };
      })
  );
}

function applyResponseFormat(payload: any, responseFormat: any) {
  if (!responseFormat) return;
  if (responseFormat.type === "json_object") {
    payload.generationConfig.responseMimeType = "application/json";
  } else if (responseFormat.type === "json_schema") {
    payload.generationConfig.responseMimeType = "application/json";
    if (responseFormat.json_schema?.schema) {
      payload.generationConfig.responseSchema = responseFormat.json_schema.schema;
    }
  }
}

export function resolveGeminiModel(rawModel?: string): string {
  if (!rawModel) return "gemini-3-flash-preview";
  const clean = rawModel.replace(/^gemini\//, "").trim();
  // Automatic modern model upgrade for deprecated models
  if (
    clean === "gemini-2.0-flash" ||
    clean === "gemini-1.5-flash" ||
    clean === "gemini-pro" ||
    clean === "gemini-flash" ||
    clean === "default"
  ) {
    return "gemini-3-flash-preview";
  }
  if (clean === "gemini-1.5-pro" || clean === "gemini-2.0-pro-exp-02-05") {
    return "gemini-2.5-pro";
  }
  return clean;
}

export async function callGemini(
  apiKey: string,
  request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  const model = resolveGeminiModel(request.model);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Extract system prompt if present
  const systemMsg = request.messages.find(m => m.role === "system");
  const contents = await buildGeminiContents(request.messages);

  const payload: any = {
    contents,
    generationConfig: {
      temperature: request.temperature ?? 0.7,
      maxOutputTokens: request.max_tokens ?? 4096,
      topP: request.top_p ?? 0.95,
    },
  };

  applyResponseFormat(payload, request.response_format);

  if (systemMsg) {
    const sysParts = await parseMessageContentAsync(systemMsg.content);
    payload.systemInstruction = {
      parts: sysParts,
    };
  }

  const geminiTools = convertToolsToGemini(request.tools);
  if (geminiTools) {
    payload.tools = geminiTools;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Gemini API error (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as any;
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  let text = "";
  const toolCalls: ToolCall[] = [];

  for (const part of parts) {
    if (part.text) {
      text += part.text;
    }
    if (part.functionCall) {
      toolCalls.push({
        id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: "function",
        function: {
          name: part.functionCall.name,
          arguments: JSON.stringify(part.functionCall.args || {}),
        },
      });
    }
  }

  const promptTokens = data.usageMetadata?.promptTokenCount || 0;
  const completionTokens = data.usageMetadata?.candidatesTokenCount || 0;

  return {
    id: `chatcmpl_gemini_${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: text,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        },
        finish_reason: toolCalls.length > 0 ? "tool_calls" : candidate?.finishReason?.toLowerCase() || "stop",
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  };
}

export async function* streamGemini(
  apiKey: string,
  request: ChatCompletionRequest
): AsyncGenerator<{ chunk: string; text?: string; tokens?: { prompt: number; completion: number } }> {
  const model = resolveGeminiModel(request.model);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const systemMsg = request.messages.find(m => m.role === "system");
  const contents = await buildGeminiContents(request.messages);

  const payload: any = {
    contents,
    generationConfig: {
      temperature: request.temperature ?? 0.7,
      maxOutputTokens: request.max_tokens ?? 4096,
      topP: request.top_p ?? 0.95,
    },
  };

  applyResponseFormat(payload, request.response_format);

  if (systemMsg) {
    const sysParts = await parseMessageContentAsync(systemMsg.content);
    payload.systemInstruction = {
      parts: sysParts,
    };
  }

  const geminiTools = convertToolsToGemini(request.tools);
  if (geminiTools) {
    payload.tools = geminiTools;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok || !res.body) {
    const errText = await res.text();
    throw new Error(`Google Gemini stream error (${res.status}): ${errText}`);
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
      if (trimmed.startsWith("data: ")) {
        const jsonStr = trimmed.slice(6);
        try {
          const parsed = JSON.parse(jsonStr);
          const candidate = parsed.candidates?.[0];
          const parts = candidate?.content?.parts || [];
          const chunkText = parts.map((p: any) => p.text || "").join("");
          const usage = parsed.usageMetadata;

          if (chunkText) {
            const chunk: ChatCompletionChunk = {
              id: `chatcmpl_${Date.now()}`,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [
                {
                  index: 0,
                  delta: { content: chunkText },
                  finish_reason: null,
                },
              ],
            };
            yield {
              chunk: `data: ${JSON.stringify(chunk)}\n\n`,
              text: chunkText,
              tokens: usage ? { prompt: usage.promptTokenCount || 0, completion: usage.candidatesTokenCount || 0 } : undefined,
            };
          }
        } catch {
          // ignore malformed SSE
        }
      }
    }
  }

  // Done signal
  yield { chunk: `data: [DONE]\n\n` };
}
