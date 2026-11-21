import { Router, Request, Response } from "express";
import { db } from "../db.js";
import { executeChatCompletion, MODEL_ALIASES } from "../services/router.js";
import { callGemini } from "../services/gemini.js";
import { callOpenAICompatible } from "../services/openai-compatible.js";
import { callAnthropic } from "../services/anthropic.js";
import { getRotatedKey } from "../services/pricing.js";
import { getCacheMetrics, clearCache } from "../services/cache.js";

export const adminRouter = Router();

// Middleware: Admin Authentication
adminRouter.use((req: Request, res: Response, next) => {
  const token =
    req.headers["x-admin-token"] ||
    req.query.token ||
    (req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, "") : null);

  const settings = db.getSettings();
  if (token !== settings.adminToken) {
    return res.status(401).json({ error: "Unauthorized: Invalid admin token." });
  }

  next();
});

// GET /api/stats
adminRouter.get("/stats", (_req: Request, res: Response) => {
  const stats = db.getStats();
  const logs = db.listLogs(100);

  const providerDistribution: Record<string, number> = {
    gemini: 0,
    openai: 0,
    anthropic: 0,
    ollama: 0,
    groq: 0,
    deepseek: 0,
    audio: 0,
  };

  let totalLatency = 0;
  for (const l of logs) {
    const prov = (l.providerUsed || "").toLowerCase();
    if (prov.includes("gemini")) providerDistribution.gemini += 1;
    else if (prov.includes("openai")) providerDistribution.openai += 1;
    else if (prov.includes("anthropic")) providerDistribution.anthropic += 1;
    else if (prov.includes("ollama")) providerDistribution.ollama += 1;
    else if (prov.includes("groq")) providerDistribution.groq += 1;
    else if (prov.includes("deepseek")) providerDistribution.deepseek += 1;
    else if (prov.includes("audio")) providerDistribution.audio += 1;

    totalLatency += l.durationMs || 0;
  }

  const avgLatencyMs = logs.length > 0 ? Math.round(totalLatency / logs.length) : 0;

  res.json({
    stats: {
      ...stats,
      avgLatencyMs,
      providerDistribution,
    },
    settings: db.getSettings(),
  });
});

// GET /api/keys
adminRouter.get("/keys", (_req: Request, res: Response) => {
  res.json(db.listApiKeys());
});

// POST /api/keys
adminRouter.post("/keys", (req: Request, res: Response) => {
  const { name, project, rateLimitRpm, maxMonthlyTokens, maxMonthlyCostUsd, enforceProvider, allowedModels, allowedIps, expiresInDays } = req.body;
  if (!name || !project) {
    return res.status(400).json({ error: "Missing required fields: 'name' and 'project'." });
  }

  let parsedIps: string[] | undefined;
  if (Array.isArray(allowedIps)) {
    parsedIps = allowedIps;
  } else if (typeof allowedIps === "string" && allowedIps.trim()) {
    parsedIps = allowedIps.split(",").map((s: string) => s.trim()).filter(Boolean);
  }

  const newKey = db.createApiKey({
    name,
    project,
    rateLimitRpm: Number(rateLimitRpm) || 120,
    maxMonthlyTokens: maxMonthlyTokens ? Number(maxMonthlyTokens) : undefined,
    maxMonthlyCostUsd: maxMonthlyCostUsd ? Number(maxMonthlyCostUsd) : undefined,
    enforceProvider: enforceProvider && ["gemini", "openai", "anthropic", "ollama", "groq", "deepseek"].includes(enforceProvider) ? enforceProvider : undefined,
    allowedModels: Array.isArray(allowedModels) ? allowedModels : undefined,
    allowedIps: parsedIps,
    expiresInDays: expiresInDays ? Number(expiresInDays) : undefined,
  });

  res.status(201).json(newKey);
});

// PATCH /api/keys/:id
adminRouter.patch("/keys/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const { isActive } = req.body;

  if (typeof isActive !== "boolean") {
    return res.status(400).json({ error: "Field 'isActive' must be boolean." });
  }

  const updated = db.toggleApiKey(id, isActive);
  if (!updated) {
    return res.status(404).json({ error: "API key not found." });
  }

  res.json(updated);
});

// POST /api/keys/:id/reset - Reset monthly usage counter
adminRouter.post("/keys/:id/reset", (req: Request, res: Response) => {
  const { id } = req.params;
  const reset = db.resetKeyUsage(id);
  if (!reset) {
    return res.status(404).json({ error: "API key not found." });
  }
  res.json({ success: true, message: `Kuota bulanan untuk '${reset.name}' berhasil di-reset ke 0.`, key: reset });
});

// DELETE /api/keys/:id
adminRouter.delete("/keys/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = db.deleteApiKey(id);
  if (!deleted) {
    return res.status(404).json({ error: "API key not found." });
  }

  res.json({ success: true, message: "API key deleted successfully." });
});

// GET /api/logs
adminRouter.get("/logs", (req: Request, res: Response) => {
  const limit = Math.min(500, Math.max(10, Number(req.query.limit) || 100));
  res.json(db.listLogs(limit));
});

// GET /api/logs/stream - Live Server-Sent Events (SSE) log stream
adminRouter.get("/logs/stream", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const onNewLog = (log: any) => {
    try {
      res.write(`data: ${JSON.stringify(log)}\n\n`);
    } catch { }
  };

  db.on("newLog", onNewLog);

  // Keep connection alive with heartbeat
  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch { }
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    db.off("newLog", onNewLog);
  });
});

// GET /api/logs/export - CSV Export
adminRouter.get("/logs/export", (_req: Request, res: Response) => {
  const logs = db.listLogs(500);
  const headers = [
    "ID",
    "Timestamp",
    "Project",
    "Model Requested",
    "Model Used",
    "Provider",
    "Prompt Tokens",
    "Completion Tokens",
    "Duration (ms)",
    "Cost (USD)",
    "Status",
    "Error Message",
    "Prompt Preview",
    "Response Preview",
  ];

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = logs.map(l => [
    escapeCsv(l.id),
    escapeCsv(l.createdAt),
    escapeCsv(l.project),
    escapeCsv(l.modelRequested),
    escapeCsv(l.modelUsed),
    escapeCsv(l.providerUsed),
    l.promptTokens,
    l.completionTokens,
    l.durationMs,
    `$${(l.costUsd || 0).toFixed(6)}`,
    escapeCsv(l.status),
    escapeCsv(l.errorMessage || ""),
    escapeCsv(l.promptPreview || ""),
    escapeCsv(l.responsePreview || ""),
  ]);

  const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="ai-hub-logs.csv"');
  res.send(csvContent);
});

// GET /api/logs/export-json - JSON Export
adminRouter.get("/logs/export-json", (_req: Request, res: Response) => {
  const logs = db.listLogs(1000);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="ai-hub-logs-${Date.now()}.json"`);
  res.json(logs);
});

// DELETE /api/logs - Clear logs
adminRouter.delete("/logs", (_req: Request, res: Response) => {
  db.clearLogs();
  res.json({ success: true, message: "Semua log transaksi berhasil dibersihkan." });
});

// GET /api/providers
adminRouter.get("/providers", (_req: Request, res: Response) => {
  const providers = db.getProviders();
  const masked: Record<string, any> = {};
  for (const [k, v] of Object.entries(providers)) {
    masked[k] = {
      ...v,
      apiKey: v.apiKey ? `${v.apiKey.slice(0, 7)}...${v.apiKey.slice(-4)}` : "",
      hasApiKey: Boolean(v.apiKey && v.apiKey.length > 5),
    };
  }
  res.json(masked);
});

// POST /api/providers/benchmark - Diagnostic Health Benchmark Matrix across all active providers
adminRouter.post("/providers/benchmark", async (_req: Request, res: Response) => {
  const providers = db.getProviders();
  const testList = Object.entries(providers).filter(([_, cfg]) => cfg.isEnabled);

  const results = await Promise.allSettled(
    testList.map(async ([id, cfg]) => {
      const effectiveKey = getRotatedKey(id, cfg.apiKey, cfg.apiKeys);
      const startTime = Date.now();
      try {
        let replyText = "";
        let testModel = cfg.models[0] || "default";

        if (id === "gemini") {
          if (!effectiveKey) throw new Error("API key not configured");
          testModel = "gemini-3-flash-preview";
          const ping = await callGemini(effectiveKey, {
            model: testModel,
            messages: [{ role: "user", content: "Ping" }],
            max_tokens: 5,
          });
          replyText = ping.choices[0]?.message?.content || "";
        } else if (id === "openai") {
          if (!effectiveKey) throw new Error("API key not configured");
          testModel = "gpt-4o-mini";
          const ping = await callOpenAICompatible(cfg.baseUrl || "https://api.openai.com/v1", effectiveKey, {
            model: testModel,
            messages: [{ role: "user", content: "Ping" }],
            max_tokens: 5,
          });
          replyText = ping.choices[0]?.message?.content || "";
        } else if (id === "anthropic") {
          if (!effectiveKey) throw new Error("API key not configured");
          testModel = "claude-3-5-sonnet-20241022";
          const ping = await callAnthropic(effectiveKey, {
            model: testModel,
            messages: [{ role: "user", content: "Ping" }],
            max_tokens: 5,
          });
          replyText = ping.choices[0]?.message?.content || "";
        } else if (id === "ollama") {
          const baseUrl = (cfg.baseUrl || "http://localhost:11434").replace(/\/+$/, "") + "/v1";
          testModel = cfg.models[0] || "llama3.1";
          const ping = await callOpenAICompatible(baseUrl, "ollama", {
            model: testModel,
            messages: [{ role: "user", content: "Ping" }],
            max_tokens: 5,
          });
          replyText = ping.choices[0]?.message?.content || "";
        } else if (id === "groq") {
          if (!effectiveKey) throw new Error("API key not configured");
          testModel = "llama-3.1-8b-instant";
          const ping = await callOpenAICompatible(cfg.baseUrl || "https://api.groq.com/openai/v1", effectiveKey, {
            model: testModel,
            messages: [{ role: "user", content: "Ping" }],
            max_tokens: 5,
          });
          replyText = ping.choices[0]?.message?.content || "";
        } else if (id === "deepseek") {
          if (!effectiveKey) throw new Error("API key not configured");
          testModel = "deepseek-chat";
          const ping = await callOpenAICompatible(cfg.baseUrl || "https://api.deepseek.com/v1", effectiveKey, {
            model: testModel,
            messages: [{ role: "user", content: "Ping" }],
            max_tokens: 5,
          });
          replyText = ping.choices[0]?.message?.content || "";
        } else if (id === "openrouter" || id === "mistral" || id === "together" || id === "xai" || id === "cohere" || id === "perplexity") {
          if (!effectiveKey) throw new Error(`${cfg.name || id} API key not configured`);
          const defaultBaseUrls: Record<string, string> = {
            openrouter: "https://openrouter.ai/api/v1",
            mistral: "https://api.mistral.ai/v1",
            together: "https://api.together.xyz/v1",
            xai: "https://api.x.ai/v1",
            cohere: "https://api.cohere.com/v2",
            perplexity: "https://api.perplexity.ai",
          };
          const baseUrl = cfg.baseUrl || defaultBaseUrls[id];
          const extraHeaders: Record<string, string> = {};
          if (id === "openrouter") {
            extraHeaders["HTTP-Referer"] = "https://aihub.local";
            extraHeaders["X-Title"] = "AI Hub Gateway";
          }
          testModel = cfg.models[0] || "default";
          const ping = await callOpenAICompatible(baseUrl, effectiveKey, {
            model: testModel,
            messages: [{ role: "user", content: "Ping" }],
            max_tokens: 5,
          }, extraHeaders);
          replyText = ping.choices[0]?.message?.content || "";
        }

        return {
          id,
          name: cfg.name,
          model: testModel,
          status: "online",
          latencyMs: Date.now() - startTime,
          reply: replyText.slice(0, 50).trim(),
        };
      } catch (err: any) {
        return {
          id,
          name: cfg.name,
          model: cfg.models[0] || "default",
          status: "offline",
          latencyMs: Date.now() - startTime,
          error: err.message,
        };
      }
    })
  );

  const payload = results.map(r => (r.status === "fulfilled" ? r.value : { status: "error", error: "Benchmark aborted" }));
  res.json({ success: true, timestamp: new Date().toISOString(), benchmark: payload });
});

// POST /api/providers/:id
adminRouter.post("/providers/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const { apiKey, apiKeys, baseUrl, isEnabled } = req.body;

  const updates: any = {};
  if (apiKey !== undefined && apiKey.trim() !== "") updates.apiKey = apiKey.trim();
  if (apiKeys !== undefined && Array.isArray(apiKeys)) updates.apiKeys = apiKeys;
  if (baseUrl !== undefined) updates.baseUrl = baseUrl.trim();
  if (isEnabled !== undefined) updates.isEnabled = Boolean(isEnabled);

  const updated = db.updateProvider(id, updates);
  if (!updated) {
    return res.status(404).json({ error: "Provider not found." });
  }

  res.json({
    success: true,
    provider: {
      ...updated,
      apiKey: updated.apiKey ? `${updated.apiKey.slice(0, 7)}...${updated.apiKey.slice(-4)}` : "",
      hasApiKey: Boolean(updated.apiKey && updated.apiKey.length > 5),
    },
  });
});

// POST /api/providers/ollama/sync - Auto-discover local Ollama models
adminRouter.post("/providers/ollama/sync", async (req: Request, res: Response) => {
  try {
    const { baseUrl } = req.body || {};
    const models = await db.syncOllamaModels(baseUrl);
    res.json({ success: true, count: models.length, models });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/providers/:id/test - Provider health check & ping test
adminRouter.post("/providers/:id/test", async (req: Request, res: Response) => {
  const { id } = req.params;
  const providers = db.getProviders();
  const config = providers[id];

  if (!config) {
    return res.status(404).json({ success: false, error: "Provider not found." });
  }

  const effectiveKey = getRotatedKey(id, config.apiKey, config.apiKeys);
  const startTime = Date.now();

  try {
    let replyText = "";
    if (id === "gemini") {
      if (!effectiveKey) throw new Error("Gemini API key is not configured.");
      const res = await callGemini(effectiveKey, {
        model: "gemini-3-flash-preview",
        messages: [{ role: "user", content: "Ping! Reply with just 'PONG'." }],
        max_tokens: 10,
      });
      replyText = res.choices[0]?.message?.content || "";
    } else if (id === "openai") {
      if (!effectiveKey) throw new Error("OpenAI API key is not configured.");
      const res = await callOpenAICompatible(config.baseUrl || "https://api.openai.com/v1", effectiveKey, {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Ping! Reply with just 'PONG'." }],
        max_tokens: 10,
      });
      replyText = res.choices[0]?.message?.content || "";
    } else if (id === "anthropic") {
      if (!effectiveKey) throw new Error("Anthropic Claude API key is not configured.");
      const res = await callAnthropic(effectiveKey, {
        model: "claude-3-5-sonnet-20241022",
        messages: [{ role: "user", content: "Ping! Reply with just 'PONG'." }],
        max_tokens: 10,
      });
      replyText = res.choices[0]?.message?.content || "";
    } else if (id === "ollama") {
      const baseUrl = (config.baseUrl || "http://localhost:11434").replace(/\/+$/, "") + "/v1";
      const res = await callOpenAICompatible(baseUrl, "ollama", {
        model: config.models[0] || "llama3.1",
        messages: [{ role: "user", content: "Ping! Reply with just 'PONG'." }],
        max_tokens: 10,
      });
      replyText = res.choices[0]?.message?.content || "";
    } else if (id === "groq") {
      if (!effectiveKey) throw new Error("Groq API key is not configured.");
      const baseUrl = config.baseUrl || "https://api.groq.com/openai/v1";
      const res = await callOpenAICompatible(baseUrl, effectiveKey, {
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: "Ping! Reply with just 'PONG'." }],
        max_tokens: 10,
      });
      replyText = res.choices[0]?.message?.content || "";
    } else if (id === "deepseek") {
      if (!effectiveKey) throw new Error("DeepSeek API key is not configured.");
      const baseUrl = config.baseUrl || "https://api.deepseek.com/v1";
      const res = await callOpenAICompatible(baseUrl, effectiveKey, {
        model: "deepseek-chat",
        messages: [{ role: "user", content: "Ping! Reply with just 'PONG'." }],
        max_tokens: 10,
      });
      replyText = res.choices[0]?.message?.content || "";
    } else if (id === "openrouter" || id === "mistral" || id === "together" || id === "xai" || id === "cohere" || id === "perplexity") {
      if (!effectiveKey) throw new Error(`${config.name || id} API key is not configured.`);
      const defaultBaseUrls: Record<string, string> = {
        openrouter: "https://openrouter.ai/api/v1",
        mistral: "https://api.mistral.ai/v1",
        together: "https://api.together.xyz/v1",
        xai: "https://api.x.ai/v1",
        cohere: "https://api.cohere.com/v2",
        perplexity: "https://api.perplexity.ai",
      };
      const baseUrl = config.baseUrl || defaultBaseUrls[id];
      const extraHeaders: Record<string, string> = {};
      if (id === "openrouter") {
        extraHeaders["HTTP-Referer"] = "https://aihub.local";
        extraHeaders["X-Title"] = "AI Hub Gateway";
      }
      const testModel = config.models[0] || "default";
      const res = await callOpenAICompatible(baseUrl, effectiveKey, {
        model: testModel,
        messages: [{ role: "user", content: "Ping! Reply with just 'PONG'." }],
        max_tokens: 10,
      }, extraHeaders);
      replyText = res.choices[0]?.message?.content || "";
    } else {
      throw new Error(`Provider '${id}' test is not supported.`);
    }

    const latencyMs = Date.now() - startTime;
    res.json({
      success: true,
      latencyMs,
      reply: replyText.trim(),
    });
  } catch (err: any) {
    res.json({
      success: false,
      latencyMs: Date.now() - startTime,
      error: err.message,
    });
  }
});

// GET /api/prompt-presets
adminRouter.get("/prompt-presets", (_req: Request, res: Response) => {
  res.json(db.listPromptPresets());
});

// POST /api/prompt-presets
adminRouter.post("/prompt-presets", (req: Request, res: Response) => {
  const { name, description, prompt } = req.body;
  if (!name || !prompt) {
    return res.status(400).json({ error: "Missing required fields: 'name' and 'prompt'." });
  }
  const created = db.addPromptPreset({ name, description, prompt });
  res.status(201).json(created);
});

// DELETE /api/prompt-presets/:id
adminRouter.delete("/prompt-presets/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = db.deletePromptPreset(id);
  if (!deleted) {
    return res.status(404).json({ error: "Prompt preset not found." });
  }
  res.json({ success: true, message: "Preset deleted successfully." });
});

// GET /api/backup - Download complete store configuration
adminRouter.get("/backup", (_req: Request, res: Response) => {
  const backup = db.backupStore();
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", 'attachment; filename="ai-hub-backup.json"');
  res.send(JSON.stringify(backup, null, 2));
});

// POST /api/restore - Restore store from JSON payload
adminRouter.post("/restore", (req: Request, res: Response) => {
  try {
    const data = req.body;
    db.restoreStore(data);
    res.json({ success: true, message: "Store restored successfully!" });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/settings
adminRouter.post("/settings", (req: Request, res: Response) => {
  const { defaultModel, fallbackModel, adminToken, systemPrompt, enableGuardrails, enablePiiRedaction, webhookUrl, customAliases } = req.body;
  const updates: any = {};
  if (defaultModel !== undefined) updates.defaultModel = defaultModel;
  if (fallbackModel !== undefined) updates.fallbackModel = fallbackModel;
  if (adminToken !== undefined) updates.adminToken = adminToken;
  if (systemPrompt !== undefined) updates.systemPrompt = systemPrompt;
  if (enableGuardrails !== undefined) updates.enableGuardrails = Boolean(enableGuardrails);
  if (enablePiiRedaction !== undefined) updates.enablePiiRedaction = Boolean(enablePiiRedaction);
  if (webhookUrl !== undefined) updates.webhookUrl = webhookUrl.trim();
  if (customAliases !== undefined && typeof customAliases === "object") updates.customAliases = customAliases;

  const updated = db.updateSettings(updates);
  res.json({ success: true, settings: updated });
});

// POST /api/playground - Live interactive prompt tester
adminRouter.post("/playground", async (req: Request, res: Response) => {
  const { model, prompt, systemPrompt, temperature } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required." });
  }

  const messages: any[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  try {
    const result = await executeChatCompletion(
      {
        model: model || "gemini-3-flash-preview",
        messages,
        temperature: temperature !== undefined ? Number(temperature) : 0.7,
      },
      undefined,
      "playground"
    );

    res.json({
      text: result.response?.choices[0]?.message?.content || "",
      modelUsed: result.modelUsed,
      providerUsed: result.providerUsed,
      durationMs: result.durationMs,
      costUsd: result.costUsd,
      usage: result.response?.usage,
      isFallback: result.isFallback,
      isCached: result.isCached,
    });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/aliases - List system and custom aliases
adminRouter.get("/aliases", (_req: Request, res: Response) => {
  const settings = db.getSettings();
  res.json({
    systemAliases: MODEL_ALIASES,
    customAliases: settings.customAliases || {},
    smartIntents: {
      fastest: "Groq Llama 3.3 70B (Sub-detik) atau Gemini 2.0 Flash",
      cheapest: "DeepSeek Chat ($0.00014) atau Gemini 2.0 Flash",
      smartest: "OpenAI GPT-4o atau Anthropic Claude 3.5 Sonnet",
      auto: "Default Model pilihan Anda dengan failover cerdas",
    },
  });
});

// POST /api/aliases - Set or update a custom model alias
adminRouter.post("/aliases", (req: Request, res: Response) => {
  const { alias, targetModel } = req.body;
  if (!alias || !targetModel) {
    return res.status(400).json({ error: "Alias dan Target Model wajib diisi." });
  }
  const cleanAlias = alias.trim().toLowerCase();
  const cleanTarget = targetModel.trim();
  const settings = db.getSettings();
  const customAliases = { ...(settings.customAliases || {}) };
  customAliases[cleanAlias] = cleanTarget;
  db.updateSettings({ customAliases });
  res.json({ success: true, customAliases });
});

// GET /api/system/health - Realtime System & VPS Telemetry
adminRouter.get("/system/health", (_req: Request, res: Response) => {
  const mem = process.memoryUsage();
  const uptimeSeconds = Math.floor(process.uptime());
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);

  res.json({
    status: "ok",
    nodeVersion: process.version,
    platform: `${process.platform} (${process.arch})`,
    uptime: `${hours}h ${minutes}m ${uptimeSeconds % 60}s`,
    uptimeSeconds,
    memory: {
      rssMb: Number((mem.rss / 1024 / 1024).toFixed(1)),
      heapUsedMb: Number((mem.heapUsed / 1024 / 1024).toFixed(1)),
      heapTotalMb: Number((mem.heapTotal / 1024 / 1024).toFixed(1)),
    },
    activeKeys: db.listApiKeys().length,
    activeLogsCount: db.listLogs(1000).length,
    timestamp: new Date().toISOString(),
  });
});

// DELETE /api/aliases/:alias - Delete custom model alias
adminRouter.delete("/aliases/:alias", (req: Request, res: Response) => {
  const cleanAlias = (req.params.alias || "").trim().toLowerCase();
  const settings = db.getSettings();
  const customAliases = { ...(settings.customAliases || {}) };
  if (customAliases[cleanAlias]) {
    delete customAliases[cleanAlias];
    db.updateSettings({ customAliases });
  }
  res.json({ success: true, customAliases });
});

// GET /api/logs/stream - Server-Sent Events (SSE) for Real-time Log Streaming
adminRouter.get("/logs/stream", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write(`event: connected\ndata: ${JSON.stringify({ status: "connected", time: Date.now() })}\n\n`);

  const onNewLog = (log: any) => {
    try {
      res.write(`data: ${JSON.stringify(log)}\n\n`);
    } catch {
      // client disconnected
    }
  };

  db.on("newLog", onNewLog);

  const heartbeat = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    db.off("newLog", onNewLog);
    res.end();
  });
});

// GET /api/cache/stats - Get smart prompt cache metrics
adminRouter.get("/cache/stats", (_req: Request, res: Response) => {
  res.json({ success: true, ...getCacheMetrics() });
});

// POST /api/cache/clear - Clear response cache
adminRouter.post("/cache/clear", (_req: Request, res: Response) => {
  const result = clearCache();
  res.json({ success: true, ...result });
});

// GET /api/backup - Full hub configuration export
adminRouter.get("/backup", (_req: Request, res: Response) => {
  const backupData = db.backupStore();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  res.setHeader("Content-Disposition", `attachment; filename="aihub-backup-${timestamp}.json"`);
  res.setHeader("Content-Type", "application/json");
  res.json({
    app: "ai-hub",
    version: "2026.1",
    exportedAt: new Date().toISOString(),
    store: backupData,
  });
});

// POST /api/restore - Full hub configuration import & restore
adminRouter.post("/restore", (req: Request, res: Response) => {
  const { store } = req.body;
  if (!store || !store.apiKeys || !store.providerConfigs) {
    return res.status(400).json({ error: "Invalid backup format. Missing apiKeys or providerConfigs." });
  }

  try {
    db.restoreStore(store);
    res.json({ success: true, message: "Configuration successfully restored!" });
  } catch (err: any) {
    res.status(500).json({ error: `Restore failed: ${err.message}` });
  }
});

