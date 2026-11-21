import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { db } from "../db.js";
import { executeChatCompletion, MODEL_ALIASES } from "../services/router.js";
import { checkRateLimit } from "../services/rate-limit.js";
import { createEmbeddings } from "../services/embeddings.js";
import { transcribeAudio } from "../services/transcription.js";
import { generateSpeech } from "../services/tts.js";
import { generateImages } from "../services/images.js";
import { checkSafetyGuardrails } from "../services/guardrails.js";
import { calculateCost } from "../services/pricing.js";
import { sendWebhookAlert } from "../services/webhook.js";
import type { ChatCompletionRequest } from "../types.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
});

// Multer error handling wrapper
function handleUpload(fieldName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    upload.single(fieldName)(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          error: {
            message: `File upload error: ${err.message}`,
            type: "invalid_request_error",
            param: fieldName,
            code: err.code,
          },
        });
      } else if (err) {
        return res.status(400).json({
          error: {
            message: err.message || "Failed to process multipart upload",
            type: "invalid_request_error",
            param: fieldName,
            code: null,
          },
        });
      }
      next();
    });
  };
}

export const v1Router = Router();

function isModelAllowed(requestedModel: string, allowedModels?: string[]): boolean {
  if (!allowedModels || allowedModels.length === 0 || allowedModels.includes("*")) {
    return true;
  }
  const req = (requestedModel || "").toLowerCase();
  for (const rule of allowedModels) {
    const r = rule.trim().toLowerCase();
    if (r === "*") return true;
    if (r.endsWith("*") && req.startsWith(r.slice(0, -1))) return true;
    if (r === req) return true;
  }
  return false;
}

// Middleware: Verify API Key, Expiration, Quota & Rate Limit
v1Router.use((req: Request, res: Response, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({
      error: {
        message: "You must provide an API key in the Authorization header: 'Authorization: Bearer aih_live_...'",
        type: "invalid_request_error",
        param: null,
        code: "invalid_api_key",
      },
    });
  }

  const apiKey = db.getApiKey(authHeader);
  if (!apiKey) {
    return res.status(401).json({
      error: {
        message: "Invalid or inactive API key provided to AI Hub.",
        type: "authentication_error",
        param: null,
        code: "invalid_api_key",
      },
    });
  }

  // Check IP Whitelist
  if (apiKey.allowedIps && apiKey.allowedIps.length > 0) {
    const rawClientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "";
    const clientIp = rawClientIp.split(",")[0].trim().replace(/^::ffff:/, "");
    const isAllowed = apiKey.allowedIps.some(ip => {
      const cleanIp = ip.trim();
      return cleanIp === "*" || cleanIp === clientIp || cleanIp === "127.0.0.1" || cleanIp === "::1" || cleanIp === "localhost";
    });
    if (!isAllowed) {
      return res.status(403).json({
        error: {
          message: `Access denied: IP address '${clientIp}' is not authorized for this API key.`,
          type: "permission_error",
          param: null,
          code: "ip_not_allowed",
        },
      });
    }
  }

  // Check Expiration Date
  if (apiKey.expiresAt && new Date() > new Date(apiKey.expiresAt)) {
    return res.status(401).json({
      error: {
        message: `API key expired on ${apiKey.expiresAt}. Contact administrator to renew.`,
        type: "authentication_error",
        param: null,
        code: "api_key_expired",
      },
    });
  }

  // Check Token Quota Limit
  if (apiKey.maxMonthlyTokens && apiKey.totalTokens >= apiKey.maxMonthlyTokens) {
    return res.status(429).json({
      error: {
        message: `Monthly token quota exceeded. Quota is ${apiKey.maxMonthlyTokens.toLocaleString()} tokens (used: ${apiKey.totalTokens.toLocaleString()}).`,
        type: "insufficient_quota",
        param: null,
        code: "monthly_quota_exceeded",
      },
    });
  }

  // Check Financial Cost Budget Limit (USD)
  if (apiKey.maxMonthlyCostUsd && apiKey.totalCostUsd >= apiKey.maxMonthlyCostUsd) {
    return res.status(429).json({
      error: {
        message: `Monthly cost budget exceeded. Limit is $${apiKey.maxMonthlyCostUsd.toFixed(2)} (spent: $${apiKey.totalCostUsd.toFixed(2)}). Contact administrator to raise budget.`,
        type: "insufficient_quota",
        param: null,
        code: "monthly_budget_exceeded",
      },
    });
  }

  // Warning when reaching 90% quota or budget
  if (apiKey.maxMonthlyTokens && apiKey.totalTokens >= apiKey.maxMonthlyTokens * 0.9) {
    sendWebhookAlert(
      "Quota Warning (90% Reached)",
      `Client '${apiKey.project}' has consumed ${apiKey.totalTokens.toLocaleString()} of its ${apiKey.maxMonthlyTokens.toLocaleString()} monthly token quota.`,
      "warning"
    );
  }
  if (apiKey.maxMonthlyCostUsd && apiKey.totalCostUsd >= apiKey.maxMonthlyCostUsd * 0.9) {
    sendWebhookAlert(
      "Budget Warning (90% Reached)",
      `Client '${apiKey.project}' has spent $${apiKey.totalCostUsd.toFixed(2)} of its $${apiKey.maxMonthlyCostUsd.toFixed(2)} monthly USD budget limit.`,
      "warning"
    );
  }

  // Rate Limiting check
  const rate = checkRateLimit(apiKey.id, apiKey.rateLimitRpm || 120);
  res.setHeader("X-RateLimit-Limit", rate.limit.toString());
  res.setHeader("X-RateLimit-Remaining", rate.remaining.toString());
  res.setHeader("X-RateLimit-Reset", rate.resetSeconds.toString());

  if (!rate.allowed) {
    res.setHeader("Retry-After", rate.resetSeconds.toString());
    return res.status(429).json({
      error: {
        message: `Rate limit exceeded. Limit is ${rate.limit} RPM. Try again in ${rate.resetSeconds}s.`,
        type: "rate_limit_error",
        param: null,
        code: "rate_limit_exceeded",
      },
    });
  }

  // Attach key info to request
  (req as any).apiKey = apiKey;
  next();
});

// GET /v1/models - OpenAI-compatible model listing
v1Router.get("/models", (req: Request, res: Response) => {
  const apiKey = (req as any).apiKey;
  const providers = db.getProviders();
  const settings = db.getSettings();
  const modelsMap = new Map<string, { id: string; object: "model"; created: number; owned_by: string }>();

  // 1. Add all enabled provider models
  for (const [providerId, config] of Object.entries(providers)) {
    if (config.isEnabled) {
      for (const m of config.models) {
        if (isModelAllowed(m, apiKey?.allowedModels)) {
          modelsMap.set(m, {
            id: m,
            object: "model",
            created: 1700000000,
            owned_by: providerId,
          });
        }
      }
    }
  }

  // 2. Add static alias models (gpt-4o, gpt-3.5-turbo, etc.)
  for (const alias of Object.keys(MODEL_ALIASES)) {
    if (isModelAllowed(alias, apiKey?.allowedModels) && !modelsMap.has(alias)) {
      modelsMap.set(alias, {
        id: alias,
        object: "model",
        created: 1700000000,
        owned_by: "ai-hub/alias",
      });
    }
  }

  // 3. Add custom aliases from settings
  if (settings.customAliases) {
    for (const customAlias of Object.keys(settings.customAliases)) {
      if (isModelAllowed(customAlias, apiKey?.allowedModels) && !modelsMap.has(customAlias)) {
        modelsMap.set(customAlias, {
          id: customAlias,
          object: "model",
          created: 1700000000,
          owned_by: "ai-hub/custom-alias",
        });
      }
    }
  }

  // 4. Add Audio, Image & Embedding Models
  const utilityModels = [
    { id: "tts-1", owned_by: "ai-hub/audio" },
    { id: "tts-1-hd", owned_by: "ai-hub/audio" },
    { id: "whisper-1", owned_by: "ai-hub/audio" },
    { id: "dall-e-3", owned_by: "ai-hub/images" },
    { id: "dall-e-2", owned_by: "ai-hub/images" },
    { id: "pollinations", owned_by: "ai-hub/images" },
    { id: "text-embedding-004", owned_by: "ai-hub/embeddings" },
    { id: "text-embedding-3-small", owned_by: "ai-hub/embeddings" },
  ];
  for (const u of utilityModels) {
    if (isModelAllowed(u.id, apiKey?.allowedModels) && !modelsMap.has(u.id)) {
      modelsMap.set(u.id, {
        id: u.id,
        object: "model",
        created: 1700000000,
        owned_by: u.owned_by,
      });
    }
  }

  // 5. Always include "auto" model
  if (isModelAllowed("auto", apiKey?.allowedModels)) {
    modelsMap.set("auto", {
      id: "auto",
      object: "model",
      created: 1700000000,
      owned_by: "ai-hub/auto",
    });
  }

  return res.json({
    object: "list",
    data: Array.from(modelsMap.values()),
  });
});

// POST /v1/chat/completions - OpenAI-compatible Chat Completions
v1Router.post("/chat/completions", async (req: Request, res: Response) => {
  const apiKey = (req as any).apiKey;
  const body = req.body as ChatCompletionRequest;

  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return res.status(400).json({
      error: {
        message: "Invalid request: 'messages' array is required and must not be empty.",
        type: "invalid_request_error",
        param: "messages",
        code: null,
      },
    });
  }

  // Check allowedModels permission
  const requestedModel = body.model || "auto";
  if (!isModelAllowed(requestedModel, apiKey?.allowedModels)) {
    return res.status(403).json({
      error: {
        message: `Model '${requestedModel}' is not permitted for this API key. Allowed models: ${apiKey.allowedModels.join(", ")}`,
        type: "permission_error",
        param: "model",
        code: "model_not_allowed",
      },
    });
  }

  // Optional: Safety Guardrails check
  const settings = db.getSettings();
  if (settings.enableGuardrails) {
    const safety = checkSafetyGuardrails(body.messages);
    if (safety.flagged) {
      return res.status(400).json({
        error: {
          message: safety.reason,
          type: "safety_violation",
          param: "messages",
          code: "prompt_injection_flagged",
        },
      });
    }
  }

  const isStream = Boolean(body.stream);

  try {
    const result = await executeChatCompletion(body, apiKey.id, apiKey.project);

    if (result.isCached) {
      res.setHeader("X-AIHub-Cache", "HIT");
    } else {
      res.setHeader("X-AIHub-Cache", "MISS");
    }

    if (isStream && result.stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-AIHub-Provider", result.providerUsed);
      res.setHeader("X-AIHub-Model", result.modelUsed);
      if (result.isFallback) {
        res.setHeader("X-AIHub-Fallback", "true");
      }

      try {
        for await (const chunk of result.stream) {
          res.write(chunk);
        }
        res.end();
        return;
      } catch (streamErr: any) {
        console.error("[AI Hub Streaming Transmission Error]:", streamErr);
        if (res.headersSent) {
          res.write(`data: ${JSON.stringify({ error: { message: streamErr.message || "Streaming interrupted" } })}\n\n`);
          res.end();
          return;
        }
        throw streamErr;
      }
    }

    if (result.response) {
      res.setHeader("X-AIHub-Provider", result.providerUsed);
      res.setHeader("X-AIHub-Model", result.modelUsed);
      if (result.isFallback) {
        res.setHeader("X-AIHub-Fallback", "true");
      }
      return res.json(result.response);
    }

    return res.status(500).json({
      error: {
        message: "Provider did not return a valid completion payload.",
        type: "api_error",
        param: null,
        code: null,
      },
    });
  } catch (err: any) {
    console.error("[AI Hub /v1/chat/completions error]:", err);
    if (res.headersSent) {
      res.end();
      return;
    }
    return res.status(502).json({
      error: {
        message: err.message || "Failed to process chat completion upstream.",
        type: "upstream_error",
        param: null,
        code: null,
      },
    });
  }
});

// POST /v1/embeddings - Universal Embeddings API
v1Router.post("/embeddings", async (req: Request, res: Response) => {
  const { model, input } = req.body;
  if (!input) {
    return res.status(400).json({
      error: {
        message: "Invalid request: 'input' parameter is required.",
        type: "invalid_request_error",
        param: "input",
        code: null,
      },
    });
  }

  try {
    const data = await createEmbeddings({ model: model || "text-embedding-004", input });
    return res.json(data);
  } catch (err: any) {
    console.error("[AI Hub /v1/embeddings error]:", err);
    return res.status(502).json({
      error: {
        message: err.message || "Failed to generate embeddings upstream.",
        type: "upstream_error",
        param: null,
        code: null,
      },
    });
  }
});

// POST /v1/audio/transcriptions - Universal Speech-to-Text Transcription API
v1Router.post("/audio/transcriptions", handleUpload("file"), async (req: Request, res: Response) => {
  const apiKey = (req as any).apiKey;
  const file = req.file;
  if (!file) {
    return res.status(400).json({
      error: {
        message: "Invalid request: multipart 'file' field containing audio data is required.",
        type: "invalid_request_error",
        param: "file",
        code: null,
      },
    });
  }

  const model = req.body.model || "gemini-2.0-flash";
  const startTime = Date.now();

  try {
    const result = await transcribeAudio({
      buffer: file.buffer,
      mimeType: file.mimetype,
      filename: file.originalname || "audio.mp3",
      model,
    });

    const durationMs = Date.now() - startTime;
    const estPromptTokens = Math.ceil((file.size / 1024) * 4); // estimation based on audio size
    const estCompletionTokens = Math.ceil(result.text.length / 4);
    const totalTokens = estPromptTokens + estCompletionTokens;
    const costUsd = calculateCost("gemini-2.0-flash", estPromptTokens, estCompletionTokens);

    db.addLog({
      apiKeyId: apiKey?.id,
      project: apiKey?.project || "audio-client",
      modelRequested: model,
      modelUsed: model,
      providerUsed: "audio/transcription",
      promptTokens: estPromptTokens,
      completionTokens: estCompletionTokens,
      durationMs,
      costUsd,
      status: "success",
      promptPreview: `[Audio Upload: ${file.originalname} (${(file.size / 1024).toFixed(1)} KB)]`,
      responsePreview: result.text.slice(0, 300),
    });

    if (apiKey?.id) {
      db.recordKeyUsage(apiKey.id, totalTokens, costUsd);
    }

    return res.json(result);
  } catch (err: any) {
    console.error("[AI Hub /v1/audio/transcriptions error]:", err);
    db.addLog({
      apiKeyId: apiKey?.id,
      project: apiKey?.project || "audio-client",
      modelRequested: model,
      modelUsed: model,
      providerUsed: "audio/transcription",
      promptTokens: 0,
      completionTokens: 0,
      durationMs: Date.now() - startTime,
      costUsd: 0,
      status: "error",
      errorMessage: err.message,
      promptPreview: `[Audio Upload: ${file.originalname}]`,
    });

    return res.status(502).json({
      error: {
        message: err.message || "Failed to transcribe audio upstream.",
        type: "upstream_error",
        param: null,
        code: null,
      },
    });
  }
});

// POST /v1/audio/speech - Universal Text-to-Speech (TTS) API
v1Router.post("/audio/speech", async (req: Request, res: Response) => {
  const apiKey = (req as any).apiKey;
  const { model, input, voice, response_format, speed } = req.body || {};

  if (!input || typeof input !== "string" || input.trim() === "") {
    return res.status(400).json({
      error: {
        message: "Invalid request: 'input' text string is required.",
        type: "invalid_request_error",
        param: "input",
        code: null,
      },
    });
  }

  const startTime = Date.now();
  const targetModel = model || "tts-1";

  try {
    const result = await generateSpeech({
      model: targetModel,
      input,
      voice: voice || "alloy",
      response_format: response_format || "mp3",
      speed: speed ? Number(speed) : 1.0,
    });

    const durationMs = Date.now() - startTime;
    const estTokens = Math.ceil(input.length / 4);
    const costUsd = calculateCost("gpt-4o-mini", estTokens, 0);

    db.addLog({
      apiKeyId: apiKey?.id,
      project: apiKey?.project || "tts-client",
      modelRequested: targetModel,
      modelUsed: targetModel,
      providerUsed: "audio/speech",
      promptTokens: estTokens,
      completionTokens: 0,
      durationMs,
      costUsd,
      status: "success",
      promptPreview: `[TTS Input: ${input.slice(0, 100)}]`,
      responsePreview: `[Audio Generated: ${(result.buffer.length / 1024).toFixed(1)} KB]`,
    });

    if (apiKey?.id) {
      db.recordKeyUsage(apiKey.id, estTokens, costUsd);
    }

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", 'inline; filename="speech.mp3"');
    res.setHeader("X-AIHub-TTS-Cache", result.isCached ? "HIT" : "MISS");
    return res.send(result.buffer);
  } catch (err: any) {
    console.error("[AI Hub /v1/audio/speech error]:", err);
    return res.status(502).json({
      error: {
        message: err.message || "Failed to generate speech audio upstream.",
        type: "upstream_error",
        param: null,
        code: null,
      },
    });
  }
});

// POST /v1/images/generations - Universal OpenAI-Compatible Image Generation API
v1Router.post("/images/generations", async (req: Request, res: Response) => {
  const apiKey = (req as any).apiKey;
  const { prompt, model, n, size, response_format } = req.body || {};

  if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
    return res.status(400).json({
      error: {
        message: "Invalid request: 'prompt' parameter is required.",
        type: "invalid_request_error",
        param: "prompt",
        code: null,
      },
    });
  }

  const startTime = Date.now();
  const targetModel = model || "pollinations";

  try {
    const result = await generateImages({
      prompt,
      model: targetModel,
      n: n ? Number(n) : 1,
      size: size || "1024x1024",
      response_format: response_format || "url",
    });

    const durationMs = Date.now() - startTime;
    const costUsd = targetModel.startsWith("dall-e") ? 0.04 : 0;

    db.addLog({
      apiKeyId: apiKey?.id,
      project: apiKey?.project || "image-client",
      modelRequested: targetModel,
      modelUsed: targetModel,
      providerUsed: "images/generations",
      promptTokens: 0,
      completionTokens: 0,
      durationMs,
      costUsd,
      status: "success",
      promptPreview: `[Image Prompt: ${prompt.slice(0, 150)}]`,
      responsePreview: result.data[0]?.url ? `[Image URL: ${result.data[0].url}]` : `[Base64 Image Generated]`,
    });

    if (apiKey?.id) {
      db.recordKeyUsage(apiKey.id, 0, costUsd);
    }

    return res.json(result);
  } catch (err: any) {
    console.error("[AI Hub /v1/images/generations error]:", err);
    return res.status(502).json({
      error: {
        message: err.message || "Failed to generate image upstream.",
        type: "upstream_error",
        param: null,
        code: null,
      },
    });
  }
});
