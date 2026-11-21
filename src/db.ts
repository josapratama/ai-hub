import fs from "fs";
import path from "path";
import crypto from "crypto";
import { EventEmitter } from "events";
import type { ApiKey, RequestLog, ProviderConfig, PromptPreset, ProviderId } from "./types.js";

interface DatabaseStore {
  apiKeys: ApiKey[];
  logs: RequestLog[];
  providerConfigs: Record<string, ProviderConfig>;
  promptPresets?: PromptPreset[];
  settings: {
    defaultModel: string;
    fallbackModel: string;
    adminToken: string;
    systemPrompt?: string;
    enableGuardrails?: boolean;
    enablePiiRedaction?: boolean;
    webhookUrl?: string;
    customAliases?: Record<string, string>;
  };
}

const dataDir = path.resolve(process.cwd(), "data");
const storePath = path.join(dataDir, "store.json");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function getDefaultStore(): DatabaseStore {
  return {
    apiKeys: [
      {
        id: "key_nexuschat",
        name: "Nexus-Chat Integration",
        key: "aih_live_nexuschat_2026",
        project: "nexus-chat",
        allowedModels: ["*"],
        rateLimitRpm: 120,
        maxMonthlyTokens: 5000000,
        totalCostUsd: 0,
        isActive: true,
        totalRequests: 0,
        totalTokens: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: "key_resumecraft",
        name: "ResumeCraft AI Integration",
        key: "aih_live_resumecraft_2026",
        project: "resumecraft",
        allowedModels: ["*"],
        rateLimitRpm: 120,
        maxMonthlyTokens: 5000000,
        totalCostUsd: 0,
        isActive: true,
        totalRequests: 0,
        totalTokens: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: "key_default",
        name: "Default General Testing Key",
        key: "aih_live_default_key_2026",
        project: "general",
        allowedModels: ["*"],
        rateLimitRpm: 60,
        maxMonthlyTokens: 1000000,
        totalCostUsd: 0,
        isActive: true,
        totalRequests: 0,
        totalTokens: 0,
        createdAt: new Date().toISOString(),
      },
    ],
    logs: [],
    providerConfigs: {
      gemini: {
        id: "gemini",
        name: "Google Gemini",
        apiKey: process.env.GEMINI_API_KEY || "",
        isEnabled: true,
        isAvailable: Boolean(process.env.GEMINI_API_KEY),
        models: ["gemini-3-flash-preview", "gemini-2.5-pro", "gemini-2.5-flash"],
      },
      openai: {
        id: "openai",
        name: "OpenAI",
        apiKey: process.env.OPENAI_API_KEY || "",
        isEnabled: true,
        isAvailable: Boolean(process.env.OPENAI_API_KEY),
        models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
      },
      anthropic: {
        id: "anthropic",
        name: "Anthropic Claude",
        apiKey: process.env.ANTHROPIC_API_KEY || "",
        isEnabled: true,
        isAvailable: Boolean(process.env.ANTHROPIC_API_KEY),
        models: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
      },
      ollama: {
        id: "ollama",
        name: "Ollama (Self-Hosted / Local)",
        baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
        isEnabled: true,
        isAvailable: true,
        models: ["llama3.1", "mistral", "deepseek-r1", "qwen2.5", "llava"],
      },
      groq: {
        id: "groq",
        name: "Groq (Ultra-Fast Cloud)",
        apiKey: process.env.GROQ_API_KEY || "",
        baseUrl: "https://api.groq.com/openai/v1",
        isEnabled: Boolean(process.env.GROQ_API_KEY),
        isAvailable: Boolean(process.env.GROQ_API_KEY),
        models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "deepseek-r1-distill-llama-70b", "mixtral-8x7b-32768"],
      },
      deepseek: {
        id: "deepseek",
        name: "DeepSeek Official API",
        apiKey: process.env.DEEPSEEK_API_KEY || "",
        baseUrl: "https://api.deepseek.com/v1",
        isEnabled: Boolean(process.env.DEEPSEEK_API_KEY),
        isAvailable: Boolean(process.env.DEEPSEEK_API_KEY),
        models: ["deepseek-chat", "deepseek-reasoner"],
      },
      openrouter: {
        id: "openrouter",
        name: "OpenRouter (Universal Router)",
        apiKey: process.env.OPENROUTER_API_KEY || "",
        baseUrl: "https://openrouter.ai/api/v1",
        isEnabled: Boolean(process.env.OPENROUTER_API_KEY),
        isAvailable: Boolean(process.env.OPENROUTER_API_KEY),
        models: [
          "openrouter/auto",
          "anthropic/claude-3.7-sonnet",
          "deepseek/deepseek-r1",
          "meta-llama/llama-3.3-70b-instruct",
          "google/gemini-2.0-flash-001",
          "mistralai/mistral-large",
        ],
      },
      mistral: {
        id: "mistral",
        name: "Mistral AI",
        apiKey: process.env.MISTRAL_API_KEY || "",
        baseUrl: "https://api.mistral.ai/v1",
        isEnabled: Boolean(process.env.MISTRAL_API_KEY),
        isAvailable: Boolean(process.env.MISTRAL_API_KEY),
        models: [
          "mistral-large-latest",
          "mistral-small-latest",
          "codestral-latest",
          "pixtral-large-latest",
          "ministral-8b-latest",
        ],
      },
      together: {
        id: "together",
        name: "Together AI",
        apiKey: process.env.TOGETHER_API_KEY || "",
        baseUrl: "https://api.together.xyz/v1",
        isEnabled: Boolean(process.env.TOGETHER_API_KEY),
        isAvailable: Boolean(process.env.TOGETHER_API_KEY),
        models: [
          "meta-llama/Llama-3.3-70B-Instruct-Turbo",
          "deepseek-ai/DeepSeek-R1",
          "Qwen/Qwen2.5-72B-Instruct-Turbo",
          "mistralai/Mixtral-8x22B-Instruct-v0.1",
        ],
      },
      xai: {
        id: "xai",
        name: "xAI (Grok)",
        apiKey: process.env.XAI_API_KEY || "",
        baseUrl: "https://api.x.ai/v1",
        isEnabled: Boolean(process.env.XAI_API_KEY),
        isAvailable: Boolean(process.env.XAI_API_KEY),
        models: ["grok-2-latest", "grok-2-vision-latest", "grok-beta"],
      },
      cohere: {
        id: "cohere",
        name: "Cohere AI",
        apiKey: process.env.COHERE_API_KEY || "",
        baseUrl: "https://api.cohere.com/v2",
        isEnabled: Boolean(process.env.COHERE_API_KEY),
        isAvailable: Boolean(process.env.COHERE_API_KEY),
        models: ["command-r-plus-08-2024", "command-r-08-2024"],
      },
      perplexity: {
        id: "perplexity",
        name: "Perplexity AI (Web Search LLM)",
        apiKey: process.env.PERPLEXITY_API_KEY || "",
        baseUrl: "https://api.perplexity.ai",
        isEnabled: Boolean(process.env.PERPLEXITY_API_KEY),
        isAvailable: Boolean(process.env.PERPLEXITY_API_KEY),
        models: ["sonar", "sonar-pro", "sonar-reasoning"],
      },
    },
    promptPresets: [
      {
        id: "preset_code_assistant",
        name: "Software Engineer",
        description: "Produces clean, production-ready, well-commented code",
        prompt: "You are an expert principal software engineer. Provide concise, secure, idiomatic, and clean code with clear step-by-step reasoning where necessary.",
      },
      {
        id: "preset_translator",
        name: "Bilingual Translator (ID/EN)",
        description: "Accurate translation between English and Indonesian",
        prompt: "You are an expert bilingual translator specialized in English and Indonesian. Translate naturally while accurately preserving technical nuance, tone, and formatting.",
      },
      {
        id: "preset_summarizer",
        name: "Executive Summarizer",
        description: "Concise key takeaways and actionable bullet points",
        prompt: "You are an executive assistant. Condense lengthy text into high-impact key findings, critical action items, and structured bullet points.",
      },
    ],
    settings: {
      defaultModel: process.env.DEFAULT_MODEL || "gemini-3-flash-preview",
      fallbackModel: process.env.FALLBACK_MODEL || "gpt-4o-mini",
      adminToken: process.env.ADMIN_TOKEN || "aih_admin_secret_2026",
    },
  };
}

class Database extends EventEmitter {
  private store: DatabaseStore;

  constructor() {
    super();
    this.store = this.load();
    this.syncEnv();
  }

  private load(): DatabaseStore {
    const def = getDefaultStore();
    try {
      if (fs.existsSync(storePath)) {
        const raw = fs.readFileSync(storePath, "utf8");
        const data = JSON.parse(raw);
        // Ensure defaults for older records
        for (const k of data.apiKeys || []) {
          if (k.totalCostUsd === undefined) k.totalCostUsd = 0;
        }
        for (const l of data.logs || []) {
          if (l.costUsd === undefined) l.costUsd = 0;
        }
        if (!data.providerConfigs) data.providerConfigs = {};
        for (const [k, v] of Object.entries(def.providerConfigs)) {
          if (!data.providerConfigs[k]) {
            data.providerConfigs[k] = v;
          }
        }
        // Auto-upgrade deprecated Gemini models in existing store.json
        if (data.providerConfigs.gemini) {
          if (
            !data.providerConfigs.gemini.models ||
            data.providerConfigs.gemini.models.includes("gemini-2.0-flash") ||
            data.providerConfigs.gemini.models.includes("gemini-1.5-flash")
          ) {
            data.providerConfigs.gemini.models = ["gemini-3-flash-preview", "gemini-2.5-pro", "gemini-2.5-flash"];
          }
        }
        if (data.settings && (data.settings.defaultModel === "gemini-2.0-flash" || data.settings.defaultModel === "gemini-1.5-flash")) {
          data.settings.defaultModel = "gemini-3-flash-preview";
        }
        if (!data.promptPresets || data.promptPresets.length === 0) {
          data.promptPresets = def.promptPresets;
        }
        return data;
      }
    } catch (err) {
      console.warn("[Database] Failed to read store.json, using defaults:", err);
    }
    this.saveDirect(def);
    return def;
  }

  private syncEnv() {
    let changed = false;
    if (process.env.GEMINI_API_KEY && !this.store.providerConfigs.gemini?.apiKey) {
      this.store.providerConfigs.gemini.apiKey = process.env.GEMINI_API_KEY;
      this.store.providerConfigs.gemini.isAvailable = true;
      changed = true;
    }
    if (process.env.OPENAI_API_KEY && !this.store.providerConfigs.openai?.apiKey) {
      this.store.providerConfigs.openai.apiKey = process.env.OPENAI_API_KEY;
      this.store.providerConfigs.openai.isAvailable = true;
      changed = true;
    }
    if (process.env.ANTHROPIC_API_KEY && !this.store.providerConfigs.anthropic?.apiKey) {
      this.store.providerConfigs.anthropic.apiKey = process.env.ANTHROPIC_API_KEY;
      this.store.providerConfigs.anthropic.isAvailable = true;
      changed = true;
    }
    if (process.env.GROQ_API_KEY && !this.store.providerConfigs.groq?.apiKey) {
      this.store.providerConfigs.groq.apiKey = process.env.GROQ_API_KEY;
      this.store.providerConfigs.groq.isEnabled = true;
      this.store.providerConfigs.groq.isAvailable = true;
      changed = true;
    }
    if (process.env.DEEPSEEK_API_KEY && !this.store.providerConfigs.deepseek?.apiKey) {
      this.store.providerConfigs.deepseek.apiKey = process.env.DEEPSEEK_API_KEY;
      this.store.providerConfigs.deepseek.isEnabled = true;
      this.store.providerConfigs.deepseek.isAvailable = true;
      changed = true;
    }
    if (process.env.OPENROUTER_API_KEY && !this.store.providerConfigs.openrouter?.apiKey) {
      this.store.providerConfigs.openrouter.apiKey = process.env.OPENROUTER_API_KEY;
      this.store.providerConfigs.openrouter.isEnabled = true;
      this.store.providerConfigs.openrouter.isAvailable = true;
      changed = true;
    }
    if (process.env.MISTRAL_API_KEY && !this.store.providerConfigs.mistral?.apiKey) {
      this.store.providerConfigs.mistral.apiKey = process.env.MISTRAL_API_KEY;
      this.store.providerConfigs.mistral.isEnabled = true;
      this.store.providerConfigs.mistral.isAvailable = true;
      changed = true;
    }
    if (process.env.TOGETHER_API_KEY && !this.store.providerConfigs.together?.apiKey) {
      this.store.providerConfigs.together.apiKey = process.env.TOGETHER_API_KEY;
      this.store.providerConfigs.together.isEnabled = true;
      this.store.providerConfigs.together.isAvailable = true;
      changed = true;
    }
    if (process.env.XAI_API_KEY && !this.store.providerConfigs.xai?.apiKey) {
      this.store.providerConfigs.xai.apiKey = process.env.XAI_API_KEY;
      this.store.providerConfigs.xai.isEnabled = true;
      this.store.providerConfigs.xai.isAvailable = true;
      changed = true;
    }
    if (process.env.COHERE_API_KEY && !this.store.providerConfigs.cohere?.apiKey) {
      this.store.providerConfigs.cohere.apiKey = process.env.COHERE_API_KEY;
      this.store.providerConfigs.cohere.isEnabled = true;
      this.store.providerConfigs.cohere.isAvailable = true;
      changed = true;
    }
    if (process.env.PERPLEXITY_API_KEY && !this.store.providerConfigs.perplexity?.apiKey) {
      this.store.providerConfigs.perplexity.apiKey = process.env.PERPLEXITY_API_KEY;
      this.store.providerConfigs.perplexity.isEnabled = true;
      this.store.providerConfigs.perplexity.isAvailable = true;
      changed = true;
    }
    if (changed) {
      this.save();
    }
  }

  private saveDirect(data: DatabaseStore) {
    try {
      const tmpPath = `${storePath}.tmp.${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf8");
      fs.renameSync(tmpPath, storePath);
    } catch (err) {
      console.warn("[Database] Atomic save fallback to direct write:", err);
      try {
        fs.writeFileSync(storePath, JSON.stringify(data, null, 2), "utf8");
      } catch (inner) {
        console.error("[Database] Critical write failure:", inner);
      }
    }
  }

  public save() {
    this.saveDirect(this.store);
  }

  // --- API Key Methods ---
  public getApiKey(rawKey: string): ApiKey | null {
    const cleanKey = rawKey.replace(/^Bearer\s+/i, "").trim();
    return this.store.apiKeys.find(k => k.key === cleanKey && k.isActive) || null;
  }

  public listApiKeys(): ApiKey[] {
    return this.store.apiKeys;
  }

  public createApiKey(params: {
    name: string;
    project: string;
    rateLimitRpm?: number;
    maxMonthlyTokens?: number;
    maxMonthlyCostUsd?: number;
    enforceProvider?: ProviderId;
    allowedModels?: string[];
    allowedIps?: string[];
    expiresInDays?: number;
  }): ApiKey {
    const randomHex = crypto.randomBytes(16).toString("hex");
    let expiresAt: string | undefined;
    if (params.expiresInDays !== undefined && params.expiresInDays !== null) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + params.expiresInDays);
      expiresAt = expDate.toISOString();
    }

    const newKey: ApiKey = {
      id: `key_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: params.name,
      key: `aih_live_${params.project.toLowerCase().replace(/[^a-z0-9]/g, "")}_${randomHex}`,
      project: params.project,
      allowedModels: params.allowedModels && params.allowedModels.length > 0 ? params.allowedModels : ["*"],
      allowedIps: params.allowedIps && params.allowedIps.length > 0 ? params.allowedIps : undefined,
      rateLimitRpm: params.rateLimitRpm || 120,
      maxMonthlyTokens: params.maxMonthlyTokens || 2000000,
      maxMonthlyCostUsd: params.maxMonthlyCostUsd !== undefined ? Number(params.maxMonthlyCostUsd) : undefined,
      enforceProvider: params.enforceProvider,
      totalCostUsd: 0,
      isActive: true,
      totalRequests: 0,
      totalTokens: 0,
      expiresAt,
      createdAt: new Date().toISOString(),
    };
    this.store.apiKeys.push(newKey);
    this.save();
    return newKey;
  }

  public backupStore(): DatabaseStore {
    return this.store;
  }

  public restoreStore(newStore: DatabaseStore): boolean {
    if (!newStore || !Array.isArray(newStore.apiKeys) || !newStore.providerConfigs) {
      throw new Error("Invalid store payload format");
    }
    this.store = newStore;
    this.save();
    return true;
  }

  public deleteApiKey(id: string): boolean {
    const idx = this.store.apiKeys.findIndex(k => k.id === id);
    if (idx === -1) return false;
    this.store.apiKeys.splice(idx, 1);
    this.save();
    return true;
  }

  public toggleApiKey(id: string, isActive: boolean): ApiKey | null {
    const key = this.store.apiKeys.find(k => k.id === id);
    if (!key) return null;
    key.isActive = isActive;
    this.save();
    return key;
  }

  public recordKeyUsage(keyId: string, tokens: number, costUsd: number = 0) {
    const key = this.store.apiKeys.find(k => k.id === keyId);
    if (key) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      if (key.lastResetMonth !== currentMonth) {
        key.currentMonthTokens = 0;
        key.currentMonthCostUsd = 0;
        key.lastResetMonth = currentMonth;
        key.alertThresholdSent = 0;
      }
      key.totalRequests += 1;
      key.totalTokens += tokens;
      key.totalCostUsd = Number(((key.totalCostUsd || 0) + costUsd).toFixed(6));
      key.currentMonthTokens = (key.currentMonthTokens || 0) + tokens;
      key.currentMonthCostUsd = Number(((key.currentMonthCostUsd || 0) + costUsd).toFixed(6));
      key.lastUsedAt = new Date().toISOString();

      // Check quota thresholds
      if (key.maxMonthlyTokens && key.maxMonthlyTokens > 0) {
        const pct = (key.currentMonthTokens / key.maxMonthlyTokens) * 100;
        if (pct >= 100 && (key.alertThresholdSent || 0) < 100) {
          key.alertThresholdSent = 100;
          this.emit("budgetAlert", { key, threshold: 100, pct: Math.round(pct) });
        } else if (pct >= 80 && (key.alertThresholdSent || 0) < 80) {
          key.alertThresholdSent = 80;
          this.emit("budgetAlert", { key, threshold: 80, pct: Math.round(pct) });
        }
      }

      this.save();
    }
  }

  public resetKeyUsage(keyId: string): ApiKey | null {
    const key = this.store.apiKeys.find(k => k.id === keyId);
    if (!key) return null;
    const currentMonth = new Date().toISOString().slice(0, 7);
    key.currentMonthTokens = 0;
    key.currentMonthCostUsd = 0;
    key.lastResetMonth = currentMonth;
    this.save();
    return key;
  }

  // --- Logging Methods ---
  public addLog(log: Omit<RequestLog, "id" | "createdAt">): RequestLog {
    const entry: RequestLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...log,
      costUsd: log.costUsd || 0,
      createdAt: new Date().toISOString(),
    };
    this.store.logs.unshift(entry);
    if (this.store.logs.length > 500) {
      this.store.logs = this.store.logs.slice(0, 500);
    }
    this.save();
    this.emit("newLog", entry);
    return entry;
  }

  public listLogs(limit: number = 100): RequestLog[] {
    return this.store.logs.slice(0, limit);
  }

  public clearLogs(): void {
    this.store.logs = [];
    this.save();
  }

  // --- Prompt Preset Methods ---
  public listPromptPresets(): PromptPreset[] {
    return this.store.promptPresets || [];
  }

  public addPromptPreset(preset: Omit<PromptPreset, "id">): PromptPreset {
    const newPreset: PromptPreset = {
      id: `preset_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...preset,
    };
    if (!this.store.promptPresets) this.store.promptPresets = [];
    this.store.promptPresets.push(newPreset);
    this.save();
    return newPreset;
  }

  public deletePromptPreset(id: string): boolean {
    if (!this.store.promptPresets) return false;
    const idx = this.store.promptPresets.findIndex(p => p.id === id);
    if (idx === -1) return false;
    this.store.promptPresets.splice(idx, 1);
    this.save();
    return true;
  }

  // --- Provider Configs ---
  public getProviders(): Record<string, ProviderConfig> {
    return this.store.providerConfigs;
  }

  public updateProvider(id: string, updates: Partial<ProviderConfig>): ProviderConfig | null {
    const provider = this.store.providerConfigs[id];
    if (!provider) return null;
    Object.assign(provider, updates);
    if (updates.apiKey !== undefined) {
      provider.isAvailable = Boolean(updates.apiKey && updates.apiKey.trim().length > 0);
    }
    this.save();
    return provider;
  }

  public async syncOllamaModels(baseUrl?: string): Promise<string[]> {
    const urlsToTry: string[] = [];
    if (baseUrl) urlsToTry.push(baseUrl.replace(/\/+$/, ""));
    const configuredUrl = this.store.providerConfigs.ollama?.baseUrl;
    if (configuredUrl) urlsToTry.push(configuredUrl.replace(/\/+$/, ""));
    urlsToTry.push("http://localhost:11434");
    urlsToTry.push("http://host.docker.internal:11434");
    urlsToTry.push("http://172.17.0.1:11434");
    urlsToTry.push("http://192.168.100.184:11434");

    const uniqueUrls = Array.from(new Set(urlsToTry));
    let lastError: any = null;

    for (const targetUrl of uniqueUrls) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(`${targetUrl}/api/tags`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) continue;

        const data = (await res.json()) as any;
        const models = (data.models || []).map((m: any) => m.name || m.model).filter(Boolean);
        if (models.length > 0) {
          if (!this.store.providerConfigs.ollama) {
            this.store.providerConfigs.ollama = {
              id: "ollama",
              name: "Ollama (Self-Hosted / Local)",
              baseUrl: targetUrl,
              isEnabled: true,
              isAvailable: true,
              models: [],
            };
          }
          this.store.providerConfigs.ollama.baseUrl = targetUrl;
          this.store.providerConfigs.ollama.models = Array.from(new Set([...this.store.providerConfigs.ollama.models, ...models]));
          this.store.providerConfigs.ollama.isAvailable = true;
          this.save();
          return this.store.providerConfigs.ollama.models;
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    if (lastError) {
      console.warn("[Database] Failed to auto-sync Ollama models across candidate URLs:", lastError.message);
    }
    return this.store.providerConfigs.ollama?.models || [];
  }

  // --- Settings ---
  public getSettings() {
    return this.store.settings;
  }

  public updateSettings(updates: Partial<DatabaseStore["settings"]>) {
    Object.assign(this.store.settings, updates);
    this.save();
    return this.store.settings;
  }

  // --- Stats Aggregation ---
  public getStats() {
    const totalRequests = this.store.logs.length;
    const totalTokens = this.store.logs.reduce((acc, l) => acc + (l.promptTokens + l.completionTokens), 0);
    const totalCostUsd = Number(this.store.logs.reduce((acc, l) => acc + (l.costUsd || 0), 0).toFixed(4));
    const successfulRequests = this.store.logs.filter(l => l.status === "success").length;
    const failedRequests = totalRequests - successfulRequests;
    const successRate = totalRequests > 0 ? Math.round((successfulRequests / totalRequests) * 100) : 100;
    const activeKeysCount = this.store.apiKeys.filter(k => k.isActive).length;

    // Requests in last 24h
    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    const requests24h = this.store.logs.filter(l => new Date(l.createdAt).getTime() > last24h).length;

    // Daily history for the last 7 days for visual analytics
    const dailyHistory: { date: string; label: string; requests: number; tokens: number; costUsd: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split("T")[0];
      const dayLabel = d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
      const dayLogs = this.store.logs.filter(l => l.createdAt.startsWith(dateStr));
      const reqCount = dayLogs.length;
      const tokCount = dayLogs.reduce((acc, l) => acc + (l.promptTokens + l.completionTokens), 0);
      const costCount = Number(dayLogs.reduce((acc, l) => acc + (l.costUsd || 0), 0).toFixed(4));
      dailyHistory.push({
        date: dateStr,
        label: dayLabel,
        requests: reqCount,
        tokens: tokCount,
        costUsd: costCount,
      });
    }

    return {
      totalRequests,
      totalTokens,
      totalCostUsd,
      successRate,
      failedRequests,
      activeKeysCount,
      requests24h,
      dailyHistory,
    };
  }
}

export const db = new Database();
