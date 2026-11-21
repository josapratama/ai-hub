import { db } from "../db.js";
import { callGemini, streamGemini } from "./gemini.js";
import { callOpenAICompatible, streamOpenAICompatible } from "./openai-compatible.js";
import { callAnthropic, streamAnthropic } from "./anthropic.js";
import { generateCacheKey, getCachedResponse, setCachedResponse } from "./cache.js";
import { calculateCost, getRotatedKey } from "./pricing.js";
import { sendWebhookAlert } from "./webhook.js";
import { redactSensitiveData } from "./guardrails.js";
import type { ChatCompletionRequest, ChatCompletionResponse, ProviderId } from "../types.js";

export interface ExecutionResult {
  response?: ChatCompletionResponse;
  stream?: AsyncGenerator<string>;
  providerUsed: string;
  modelUsed: string;
  durationMs: number;
  costUsd: number;
  isFallback: boolean;
  isCached?: boolean;
}

export const MODEL_ALIASES: Record<string, string> = {
  "gpt-3.5-turbo": "gpt-4o-mini",
  "gpt-3.5": "gpt-4o-mini",
  "gpt-4": "gpt-4o",
  "gemini-pro": "gemini-2.0-flash",
  "gemini-1.5": "gemini-1.5-flash",
  "claude-3-sonnet": "claude-3-5-sonnet-20241022",
  "claude-3-haiku": "claude-3-5-haiku-20241022",
};

export function detectProvider(modelName: string): ProviderId {
  const m = (modelName || "").toLowerCase();
  const providers = db.getProviders();

  // 1. Explicit OpenRouter prefix or slashed model name (e.g. "openrouter/...", "anthropic/claude-3.7-sonnet", "deepseek/deepseek-r1")
  if (m.startsWith("openrouter/")) return "openrouter";
  if (m.includes("/")) {
    if (providers.openrouter?.isEnabled && providers.openrouter?.apiKey) return "openrouter";
    if (providers.together?.isEnabled && providers.together?.apiKey) return "together";
  }

  // 2. Perplexity Sonar
  if (m.startsWith("sonar") || m.startsWith("perplexity/")) return "perplexity";

  // 3. xAI Grok
  if (m.startsWith("grok")) return "xai";

  // 4. Cohere Command
  if (m.startsWith("command-r") || m.startsWith("cohere/")) return "cohere";

  // 5. Native Provider Model Families
  if (m.startsWith("gemini")) return "gemini";
  if (m.startsWith("claude")) return "anthropic";
  if (m.startsWith("gpt") || m.startsWith("o1") || m.startsWith("o3") || m.startsWith("text-embedding")) return "openai";

  // 6. Mistral AI Cloud vs Ollama
  if (m.startsWith("mistral") || m.startsWith("codestral") || m.startsWith("pixtral") || m.startsWith("ministral")) {
    if (providers.mistral?.isEnabled && providers.mistral?.apiKey) {
      return "mistral";
    }
    return "ollama";
  }

  // 7. DeepSeek Cloud vs Ollama
  if (m.startsWith("deepseek")) {
    if (providers.deepseek?.isEnabled && providers.deepseek?.apiKey) {
      return "deepseek";
    }
  }

  // 8. Groq Cloud
  if (m.startsWith("groq") || m.includes("versatile") || m.includes("instant")) {
    return "groq";
  }
  if ((m.startsWith("llama") || m.startsWith("mixtral") || m.startsWith("gemma")) && providers.groq?.isEnabled && providers.groq?.apiKey) {
    return "groq";
  }

  // 9. Ollama local
  if (m.startsWith("llama") || m.startsWith("deepseek") || m.startsWith("qwen") || m.startsWith("llava")) {
    return "ollama";
  }

  // 10. Fallback: if OpenRouter is active, it can route anything
  if (providers.openrouter?.isEnabled && providers.openrouter?.apiKey) {
    return "openrouter";
  }

  return "gemini"; // default provider
}

async function* wrapTrackedStream(
  rawStream: AsyncGenerator<{ chunk: string; text?: string; tokens?: { prompt: number; completion: number } }>,
  onComplete: (accumulatedText: string, finalTokens?: { prompt: number; completion: number }, ttftMs?: number, error?: Error) => void
): AsyncGenerator<string> {
  let accumulatedText = "";
  let finalTokens: { prompt: number; completion: number } | undefined;
  let ttftMs: number | undefined;
  const streamStart = Date.now();
  try {
    for await (const item of rawStream) {
      if (ttftMs === undefined && (item.text || item.chunk)) {
        ttftMs = Date.now() - streamStart;
      }
      if (item.text) accumulatedText += item.text;
      if (item.tokens) finalTokens = item.tokens;
      yield item.chunk;
    }
    onComplete(accumulatedText, finalTokens, ttftMs);
  } catch (err: any) {
    onComplete(accumulatedText, finalTokens, ttftMs, err);
    throw err;
  }
}

function getPromptPreview(messages: any[]): string {
  try {
    const lastUser = [...messages].reverse().find(m => m.role === "user");
    if (lastUser) {
      if (typeof lastUser.content === "string") return lastUser.content.slice(0, 300);
      return JSON.stringify(lastUser.content).slice(0, 300);
    }
    return JSON.stringify(messages).slice(0, 300);
  } catch {
    return "";
  }
}

export async function executeChatCompletion(
  rawRequest: ChatCompletionRequest,
  apiKeyId?: string,
  projectName: string = "unknown"
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const settings = db.getSettings();
  const providers = db.getProviders();

  // Resolve model, aliases, and smart intents
  const rawModel = (rawRequest.model || "").trim().toLowerCase();
  let targetModel = rawRequest.model || "";

  if (!rawModel || rawModel === "auto" || rawModel === "default") {
    targetModel = settings.defaultModel || "gemini-2.0-flash";
  } else if (rawModel === "fastest") {
    if (providers.groq?.isEnabled && providers.groq?.isAvailable) {
      targetModel = "llama-3.3-70b-versatile";
    } else {
      targetModel = "gemini-2.0-flash";
    }
  } else if (rawModel === "cheapest") {
    if (providers.deepseek?.isEnabled && providers.deepseek?.isAvailable) {
      targetModel = "deepseek-chat";
    } else {
      targetModel = "gemini-2.0-flash";
    }
  } else if (rawModel === "smartest") {
    if (providers.openai?.isEnabled && providers.openai?.isAvailable) {
      targetModel = "gpt-4o";
    } else if (providers.anthropic?.isEnabled && providers.anthropic?.isAvailable) {
      targetModel = "claude-3-5-sonnet-20241022";
    } else {
      targetModel = "gemini-1.5-pro";
    }
  } else if (settings.customAliases?.[rawModel]) {
    targetModel = settings.customAliases[rawModel];
  } else if (settings.customAliases?.[targetModel]) {
    targetModel = settings.customAliases[targetModel];
  } else if (MODEL_ALIASES[rawModel]) {
    targetModel = MODEL_ALIASES[rawModel];
  } else if (MODEL_ALIASES[targetModel]) {
    targetModel = MODEL_ALIASES[targetModel];
  }

  // Clone request and inject global system prompt if configured
  const messages = [...(rawRequest.messages || [])];
  if (settings.systemPrompt && settings.systemPrompt.trim() !== "") {
    const existingSysIdx = messages.findIndex(m => m.role === "system");
    if (existingSysIdx >= 0) {
      messages[existingSysIdx] = {
        role: "system",
        content: `${settings.systemPrompt.trim()}\n\n${messages[existingSysIdx].content}`,
      };
    } else {
      messages.unshift({
        role: "system",
        content: settings.systemPrompt.trim(),
      });
    }
  }

  // Apply PII data redaction if enabled in settings
  if (settings.enablePiiRedaction) {
    const { messages: sanitized } = redactSensitiveData(messages);
    messages.splice(0, messages.length, ...sanitized);
  }

  const request: ChatCompletionRequest = {
    ...rawRequest,
    model: targetModel,
    messages,
  };

  const promptPreview = getPromptPreview(request.messages);

  // Check smart cache for non-streaming calls
  let cacheKey = "";
  if (!request.stream) {
    cacheKey = generateCacheKey(targetModel, request.messages);
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      const durationMs = Date.now() - startTime;
      const costUsd = calculateCost(targetModel, 0, cached.usage?.completion_tokens || 0);
      const respPreview = cached.choices?.[0]?.message?.content ? String(cached.choices[0].message.content).slice(0, 300) : "";

      db.addLog({
        apiKeyId,
        project: projectName,
        modelRequested: rawRequest.model,
        modelUsed: targetModel,
        providerUsed: `${detectProvider(targetModel)} (cache)`,
        promptTokens: cached.usage?.prompt_tokens || 0,
        completionTokens: cached.usage?.completion_tokens || 0,
        durationMs,
        costUsd,
        status: "success",
        promptPreview,
        responsePreview: respPreview,
      });
      if (apiKeyId && cached.usage?.total_tokens) {
        db.recordKeyUsage(apiKeyId, cached.usage.total_tokens, costUsd);
      }
      return {
        response: cached,
        providerUsed: `${detectProvider(targetModel)} (cache)`,
        modelUsed: targetModel,
        durationMs,
        costUsd,
        isFallback: false,
        isCached: true,
      };
    }
  }

  const apiKeyRecord = apiKeyId ? db.listApiKeys().find(k => k.id === apiKeyId) : undefined;
  const primaryProvider = apiKeyRecord?.enforceProvider || detectProvider(targetModel);
  const fallbackModel = settings.fallbackModel || "gpt-4o-mini";
  const fallbackProvider = apiKeyRecord?.enforceProvider || detectProvider(fallbackModel);

  // Helper to execute for a specific provider
  const runProvider = async (
    provider: string,
    model: string,
    req: ChatCompletionRequest,
    isFallbackAttempt = false
  ): Promise<ExecutionResult> => {
    const config = providers[provider];
    const modifiedReq = { ...req, model };
    const effectiveKey = getRotatedKey(provider, config?.apiKey, config?.apiKeys);

    const handleStreamComplete = (
      accumulatedText: string,
      finalTokens?: { prompt: number; completion: number },
      ttftMs?: number,
      streamErr?: Error
    ) => {
      const durationMs = Date.now() - startTime;
      if (streamErr) {
        db.addLog({
          apiKeyId,
          project: projectName,
          modelRequested: rawRequest.model,
          modelUsed: model,
          providerUsed: isFallbackAttempt ? `${provider} (fallback)` : provider,
          promptTokens: 0,
          completionTokens: 0,
          durationMs,
          ttftMs,
          costUsd: 0,
          status: "error",
          errorMessage: streamErr.message,
          promptPreview,
        });
      } else {
        const promptTokens =
          finalTokens?.prompt ??
          req.messages.reduce((acc, m) => acc + Math.ceil((m.content?.length || 0) / 4), 0);
        const completionTokens =
          finalTokens?.completion ?? Math.ceil(accumulatedText.length / 4);
        const totalTokens = promptTokens + completionTokens;
        const costUsd = calculateCost(model, promptTokens, completionTokens);

        db.addLog({
          apiKeyId,
          project: projectName,
          modelRequested: rawRequest.model,
          modelUsed: model,
          providerUsed: isFallbackAttempt ? `${provider} (fallback)` : provider,
          promptTokens,
          completionTokens,
          durationMs,
          ttftMs,
          costUsd,
          status: "success",
          promptPreview,
          responsePreview: accumulatedText.slice(0, 300),
        });

        if (apiKeyId) {
          db.recordKeyUsage(apiKeyId, totalTokens, costUsd);
        }
      }
    };

    if (provider === "gemini") {
      if (!effectiveKey) {
        throw new Error("Gemini API key is not configured in AI Hub.");
      }
      if (req.stream) {
        const rawStream = streamGemini(effectiveKey, modifiedReq);
        const trackedStream = wrapTrackedStream(rawStream, handleStreamComplete);
        return {
          stream: trackedStream,
          providerUsed: "gemini",
          modelUsed: model,
          durationMs: Date.now() - startTime,
          costUsd: 0,
          isFallback: isFallbackAttempt,
        };
      } else {
        const response = await callGemini(effectiveKey, modifiedReq);
        const costUsd = calculateCost(model, response.usage.prompt_tokens, response.usage.completion_tokens);
        return {
          response,
          providerUsed: "gemini",
          modelUsed: model,
          durationMs: Date.now() - startTime,
          costUsd,
          isFallback: isFallbackAttempt,
        };
      }
    } else if (provider === "openai") {
      if (!effectiveKey) {
        throw new Error("OpenAI API key is not configured in AI Hub.");
      }
      const baseUrl = config.baseUrl || "https://api.openai.com/v1";
      if (req.stream) {
        const rawStream = streamOpenAICompatible(baseUrl, effectiveKey, modifiedReq);
        const trackedStream = wrapTrackedStream(rawStream, handleStreamComplete);
        return {
          stream: trackedStream,
          providerUsed: "openai",
          modelUsed: model,
          durationMs: Date.now() - startTime,
          costUsd: 0,
          isFallback: isFallbackAttempt,
        };
      } else {
        const response = await callOpenAICompatible(baseUrl, effectiveKey, modifiedReq);
        const costUsd = calculateCost(model, response.usage.prompt_tokens, response.usage.completion_tokens);
        return {
          response,
          providerUsed: "openai",
          modelUsed: model,
          durationMs: Date.now() - startTime,
          costUsd,
          isFallback: isFallbackAttempt,
        };
      }
    } else if (provider === "anthropic") {
      if (!effectiveKey) {
        throw new Error("Anthropic Claude API key is not configured in AI Hub.");
      }
      if (req.stream) {
        const rawStream = streamAnthropic(effectiveKey, modifiedReq);
        const trackedStream = wrapTrackedStream(rawStream, handleStreamComplete);
        return {
          stream: trackedStream,
          providerUsed: "anthropic",
          modelUsed: model,
          durationMs: Date.now() - startTime,
          costUsd: 0,
          isFallback: isFallbackAttempt,
        };
      } else {
        const response = await callAnthropic(effectiveKey, modifiedReq);
        const costUsd = calculateCost(model, response.usage.prompt_tokens, response.usage.completion_tokens);
        return {
          response,
          providerUsed: "anthropic",
          modelUsed: model,
          durationMs: Date.now() - startTime,
          costUsd,
          isFallback: isFallbackAttempt,
        };
      }
    } else if (provider === "ollama") {
      const baseUrl = (config?.baseUrl || "http://localhost:11434").replace(/\/+$/, "") + "/v1";
      if (req.stream) {
        const rawStream = streamOpenAICompatible(baseUrl, "ollama", modifiedReq);
        const trackedStream = wrapTrackedStream(rawStream, handleStreamComplete);
        return {
          stream: trackedStream,
          providerUsed: "ollama",
          modelUsed: model,
          durationMs: Date.now() - startTime,
          costUsd: 0,
          isFallback: isFallbackAttempt,
        };
      } else {
        const response = await callOpenAICompatible(baseUrl, "ollama", modifiedReq);
        return {
          response,
          providerUsed: "ollama",
          modelUsed: model,
          durationMs: Date.now() - startTime,
          costUsd: 0,
          isFallback: isFallbackAttempt,
        };
      }
    } else if (provider === "groq") {
      if (!effectiveKey) {
        throw new Error("Groq API key is not configured in AI Hub.");
      }
      const baseUrl = config?.baseUrl || "https://api.groq.com/openai/v1";
      if (req.stream) {
        const rawStream = streamOpenAICompatible(baseUrl, effectiveKey, modifiedReq);
        const trackedStream = wrapTrackedStream(rawStream, handleStreamComplete);
        return {
          stream: trackedStream,
          providerUsed: "groq",
          modelUsed: model,
          durationMs: Date.now() - startTime,
          costUsd: 0,
          isFallback: isFallbackAttempt,
        };
      } else {
        const response = await callOpenAICompatible(baseUrl, effectiveKey, modifiedReq);
        const costUsd = calculateCost(model, response.usage.prompt_tokens, response.usage.completion_tokens);
        return {
          response,
          providerUsed: "groq",
          modelUsed: model,
          durationMs: Date.now() - startTime,
          costUsd,
          isFallback: isFallbackAttempt,
        };
      }
    } else if (provider === "deepseek") {
      if (!effectiveKey) {
        throw new Error("DeepSeek API key is not configured in AI Hub.");
      }
      const baseUrl = config?.baseUrl || "https://api.deepseek.com/v1";
      if (req.stream) {
        const rawStream = streamOpenAICompatible(baseUrl, effectiveKey, modifiedReq);
        const trackedStream = wrapTrackedStream(rawStream, handleStreamComplete);
        return {
          stream: trackedStream,
          providerUsed: "deepseek",
          modelUsed: model,
          durationMs: Date.now() - startTime,
          costUsd: 0,
          isFallback: isFallbackAttempt,
        };
      } else {
        const response = await callOpenAICompatible(baseUrl, effectiveKey, modifiedReq);
        const costUsd = calculateCost(model, response.usage.prompt_tokens, response.usage.completion_tokens);
        return {
          response,
          providerUsed: "deepseek",
          modelUsed: model,
          durationMs: Date.now() - startTime,
          costUsd,
          isFallback: isFallbackAttempt,
        };
      }
    } else if (
      provider === "openrouter" ||
      provider === "mistral" ||
      provider === "together" ||
      provider === "xai" ||
      provider === "cohere" ||
      provider === "perplexity"
    ) {
      if (!effectiveKey) {
        throw new Error(`${config?.name || provider} API key is not configured in AI Hub.`);
      }
      const defaultBaseUrls: Record<string, string> = {
        openrouter: "https://openrouter.ai/api/v1",
        mistral: "https://api.mistral.ai/v1",
        together: "https://api.together.xyz/v1",
        xai: "https://api.x.ai/v1",
        cohere: "https://api.cohere.com/v2",
        perplexity: "https://api.perplexity.ai",
      };
      const baseUrl = config?.baseUrl || defaultBaseUrls[provider];
      const extraHeaders: Record<string, string> = {};
      if (provider === "openrouter") {
        extraHeaders["HTTP-Referer"] = "https://aihub.local";
        extraHeaders["X-Title"] = "AI Hub Gateway";
      }

      if (req.stream) {
        const rawStream = streamOpenAICompatible(baseUrl, effectiveKey, modifiedReq, extraHeaders);
        const trackedStream = wrapTrackedStream(rawStream, handleStreamComplete);
        return {
          stream: trackedStream,
          providerUsed: provider,
          modelUsed: model,
          durationMs: Date.now() - startTime,
          costUsd: 0,
          isFallback: isFallbackAttempt,
        };
      } else {
        const response = await callOpenAICompatible(baseUrl, effectiveKey, modifiedReq, extraHeaders);
        const promptTokens = response.usage?.prompt_tokens || 0;
        const completionTokens = response.usage?.completion_tokens || 0;
        const costUsd = calculateCost(model, promptTokens, completionTokens);
        return {
          response,
          providerUsed: provider,
          modelUsed: model,
          durationMs: Date.now() - startTime,
          costUsd,
          isFallback: isFallbackAttempt,
        };
      }
    }

    throw new Error(`Unsupported AI provider: ${provider}`);
  };

  // 1. Try Primary Provider
  try {
    const result = await runProvider(primaryProvider, targetModel, request, false);

    // If buffered response, save to cache and record log immediately
    if (result.response) {
      if (cacheKey) {
        setCachedResponse(cacheKey, result.response, 600);
      }
      const respPreview = result.response.choices?.[0]?.message?.content ? String(result.response.choices[0].message.content).slice(0, 300) : "";
      db.addLog({
        apiKeyId,
        project: projectName,
        modelRequested: rawRequest.model,
        modelUsed: result.modelUsed,
        providerUsed: result.providerUsed,
        promptTokens: result.response.usage?.prompt_tokens || 0,
        completionTokens: result.response.usage?.completion_tokens || 0,
        durationMs: result.durationMs,
        costUsd: result.costUsd,
        status: "success",
        promptPreview,
        responsePreview: respPreview,
      });
      if (apiKeyId) {
        db.recordKeyUsage(apiKeyId, result.response.usage?.total_tokens || 0, result.costUsd);
      }
    }

    return result;
  } catch (primaryErr: any) {
    console.warn(`[AI Hub] Primary provider (${primaryProvider}/${targetModel}) failed: ${primaryErr.message}`);

    // If fallback is available and different, attempt fallback
    if (fallbackModel !== targetModel) {
      try {
        console.info(`[AI Hub] Attempting automatic failover to fallback (${fallbackProvider}/${fallbackModel})...`);
        const fallbackResult = await runProvider(fallbackProvider, fallbackModel, request, true);

        if (fallbackResult.response) {
          if (cacheKey) {
            setCachedResponse(cacheKey, fallbackResult.response, 600);
          }
          const respPreview = fallbackResult.response.choices?.[0]?.message?.content ? String(fallbackResult.response.choices[0].message.content).slice(0, 300) : "";
          db.addLog({
            apiKeyId,
            project: projectName,
            modelRequested: rawRequest.model,
            modelUsed: fallbackResult.modelUsed,
            providerUsed: `${fallbackResult.providerUsed} (fallback)`,
            promptTokens: fallbackResult.response.usage?.prompt_tokens || 0,
            completionTokens: fallbackResult.response.usage?.completion_tokens || 0,
            durationMs: fallbackResult.durationMs,
            costUsd: fallbackResult.costUsd,
            status: "success",
            promptPreview,
            responsePreview: respPreview,
          });
          if (apiKeyId) {
            db.recordKeyUsage(apiKeyId, fallbackResult.response.usage?.total_tokens || 0, fallbackResult.costUsd);
          }
        }

        sendWebhookAlert(
          "Automatic Failover Triggered",
          `Primary provider (${primaryProvider}/${targetModel}) failed (${primaryErr.message}). Successfully failed over to ${fallbackProvider}/${fallbackModel} for project '${projectName}'.`,
          "warning"
        );
        return fallbackResult;
      } catch (fallbackErr: any) {
        // Fallback also failed
        sendWebhookAlert(
          "All AI Providers Failed",
          `Project '${projectName}' request failed on primary (${targetModel}) and fallback (${fallbackModel}). Primary: ${primaryErr.message} | Fallback: ${fallbackErr.message}`,
          "error"
        );
        db.addLog({
          apiKeyId,
          project: projectName,
          modelRequested: rawRequest.model,
          modelUsed: targetModel,
          providerUsed: primaryProvider,
          promptTokens: 0,
          completionTokens: 0,
          durationMs: Date.now() - startTime,
          costUsd: 0,
          status: "error",
          errorMessage: `Primary error: ${primaryErr.message}; Fallback error: ${fallbackErr.message}`,
          promptPreview,
        });
        throw new Error(`All providers failed. Primary: ${primaryErr.message} | Fallback: ${fallbackErr.message}`);
      }
    }

    // Record failure in DB
    db.addLog({
      apiKeyId,
      project: projectName,
      modelRequested: rawRequest.model,
      modelUsed: targetModel,
      providerUsed: primaryProvider,
      promptTokens: 0,
      completionTokens: 0,
      durationMs: Date.now() - startTime,
      costUsd: 0,
      status: "error",
      errorMessage: primaryErr.message,
      promptPreview,
    });

    throw primaryErr;
  }
}
