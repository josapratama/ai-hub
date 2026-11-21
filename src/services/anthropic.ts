import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChunk,
  ToolCall,
} from "../types.js";

function convertToAnthropicMessages(req: ChatCompletionRequest): {
  systemPrompt?: string;
  messages: Array<{ role: "user" | "assistant"; content: any }>;
} {
  let systemPrompt = "";
  const systemMsgs = req.messages.filter(m => m.role === "system");
  if (systemMsgs.length > 0) {
    systemPrompt = systemMsgs.map(m => (typeof m.content === "string" ? m.content : JSON.stringify(m.content))).join("\n\n");
  }

  const raw = req.messages.filter(m => m.role !== "system");
  const rawMessages: Array<{ role: "user" | "assistant"; content: any }> = [];

  for (const m of raw) {
    const role = m.role === "assistant" ? "assistant" : "user";
    let content = m.content;

    // 1. Handle tool response role "tool" as user message with tool_result
    if ((m.role as any) === "tool") {
      rawMessages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: m.tool_call_id || "tool_call",
            content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
          },
        ],
      });
      continue;
    }

    // 2. Handle assistant messages with tool_calls (Anthropic tool_use blocks)
    if (m.role === "assistant" && m.tool_calls && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
      const parts: any[] = [];
      if (typeof content === "string" && content.trim()) {
        parts.push({ type: "text", text: content });
      }
      for (const tc of m.tool_calls) {
        let inputArgs = {};
        try {
          inputArgs = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : (tc.function.arguments || {});
        } catch {
          inputArgs = {};
        }
        parts.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input: inputArgs,
        });
      }
      rawMessages.push({ role: "assistant", content: parts });
      continue;
    }

    // 3. Normal text & vision content
    if (typeof content === "string") {
      rawMessages.push({ role, content });
    } else if (Array.isArray(content)) {
      // Vision handling
      const parts = content.map((part: any) => {
        if (part.type === "text") return { type: "text", text: part.text };
        if (part.type === "image_url") {
          const url = part.image_url?.url || "";
          if (url.startsWith("data:")) {
            const match = url.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              return {
                type: "image",
                source: {
                  type: "base64",
                  media_type: match[1],
                  data: match[2],
                },
              };
            }
          }
        }
        return { type: "text", text: JSON.stringify(part) };
      });
      rawMessages.push({ role, content: parts });
    } else {
      rawMessages.push({ role, content: JSON.stringify(content || "") });
    }
  }

  // Strict Anthropic alternation requirement: merge consecutive messages with identical role
  const messages: Array<{ role: "user" | "assistant"; content: any }> = [];
  for (const msg of rawMessages) {
    const prev = messages[messages.length - 1];
    if (prev && prev.role === msg.role) {
      const prevParts = Array.isArray(prev.content)
        ? prev.content
        : [{ type: "text", text: String(prev.content || "") }];
      const nextParts = Array.isArray(msg.content)
        ? msg.content
        : [{ type: "text", text: String(msg.content || "") }];
      prev.content = [...prevParts, ...nextParts];
    } else {
      messages.push(msg);
    }
  }

  return { systemPrompt: systemPrompt || undefined, messages };
}

function convertToolsToAnthropic(tools?: any[]): any[] | undefined {
  if (!tools || !Array.isArray(tools) || tools.length === 0) return undefined;
  return tools.map(t => {
    if (t.type === "function" && t.function) {
      return {
        name: t.function.name,
        description: t.function.description || "",
        input_schema: t.function.parameters || { type: "object", properties: {} },
      };
    }
    return t;
  });
}

export async function callAnthropic(apiKey: string, request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
  const url = "https://api.anthropic.com/v1/messages";
  const { systemPrompt, messages } = convertToAnthropicMessages(request);
  const anthropicTools = convertToolsToAnthropic(request.tools);

  const payload: any = {
    model: request.model || "claude-3-5-sonnet-20241022",
    max_tokens: request.max_tokens || 4096,
    messages,
    temperature: request.temperature ?? 0.7,
  };

  if (systemPrompt) payload.system = systemPrompt;
  if (anthropicTools) payload.tools = anthropicTools;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic Claude API error (${res.status}): ${err}`);
  }

  const data = (await res.json()) as any;
  let text = "";
  const toolCalls: ToolCall[] = [];

  for (const block of data.content || []) {
    if (block.type === "text") {
      text += block.text;
    } else if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id,
        type: "function",
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input || {}),
        },
      });
    }
  }

  const promptTokens = data.usage?.input_tokens || 0;
  const completionTokens = data.usage?.output_tokens || 0;

  return {
    id: data.id || `chatcmpl_${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: data.model || request.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: text,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        },
        finish_reason: data.stop_reason === "tool_use" ? "tool_calls" : "stop",
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  };
}

export async function* streamAnthropic(
  apiKey: string,
  request: ChatCompletionRequest
): AsyncGenerator<{ chunk: string; text?: string; tokens?: { prompt: number; completion: number } }> {
  const url = "https://api.anthropic.com/v1/messages";
  const { systemPrompt, messages } = convertToAnthropicMessages(request);
  const anthropicTools = convertToolsToAnthropic(request.tools);

  const payload: any = {
    model: request.model || "claude-3-5-sonnet-20241022",
    max_tokens: request.max_tokens || 4096,
    messages,
    temperature: request.temperature ?? 0.7,
    stream: true,
  };

  if (systemPrompt) payload.system = systemPrompt;
  if (anthropicTools) payload.tools = anthropicTools;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok || !res.body) {
    const err = await res.text();
    throw new Error(`Anthropic Claude stream error (${res.status}): ${err}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let promptTokens = 0;
  let completionTokens = 0;

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

          if (parsed.type === "message_start") {
            promptTokens = parsed.message?.usage?.input_tokens || 0;
          } else if (parsed.type === "content_block_delta" && parsed.delta?.text) {
            const chunkText = parsed.delta.text;
            const chunk: ChatCompletionChunk = {
              id: `chatcmpl_${Date.now()}`,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: request.model,
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
            };
          } else if (parsed.type === "message_delta") {
            completionTokens = parsed.usage?.output_tokens || 0;
          }
        } catch {
          // ignore parsing error
        }
      }
    }
  }

  yield {
    chunk: `data: [DONE]\n\n`,
    tokens: { prompt: promptTokens, completion: completionTokens },
  };
}
