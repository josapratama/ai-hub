export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: any; // string or array for multimodal vision
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  tools?: any[];
  tool_choice?: any;
  response_format?: any;
}

export interface ChatCompletionResponseChoice {
  index: number;
  message: Message;
  finish_reason: string;
}

export interface ChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: ChatCompletionResponseChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatCompletionChunkChoice {
  index: number;
  delta: {
    role?: "assistant";
    content?: string;
    tool_calls?: ToolCall[];
  };
  finish_reason: string | null;
}

export interface ChatCompletionChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: ChatCompletionChunkChoice[];
}

export type ProviderId =
  | "gemini"
  | "openai"
  | "anthropic"
  | "ollama"
  | "groq"
  | "deepseek"
  | "openrouter"
  | "mistral"
  | "together"
  | "xai"
  | "cohere"
  | "perplexity"
  | string;

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  project: string;
  allowedModels?: string[];
  allowedIps?: string[];
  rateLimitRpm: number;
  maxMonthlyTokens?: number; // Quota cap (e.g. 1_000_000)
  maxMonthlyCostUsd?: number; // Financial cost budget limit (e.g. $5.00)
  enforceProvider?: ProviderId;
  totalCostUsd: number;
  isActive: boolean;
  totalRequests: number;
  totalTokens: number;
  expiresAt?: string; // Optional expiry date ISO
  createdAt: string;
  lastUsedAt?: string;
}

export interface PromptPreset {
  id: string;
  name: string;
  description?: string;
  prompt: string;
}

export interface RequestLog {
  id: string;
  apiKeyId?: string;
  project: string;
  modelRequested: string;
  modelUsed: string;
  providerUsed: string;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
  ttftMs?: number; // Time to First Token in milliseconds
  costUsd: number;
  status: "success" | "error";
  errorMessage?: string;
  promptPreview?: string;
  responsePreview?: string;
  createdAt: string;
}

export interface ImageGenerationRequest {
  prompt: string;
  model?: string;
  n?: number;
  size?: "256x256" | "512x512" | "1024x1024" | string;
  response_format?: "url" | "b64_json";
}

export interface ImageGenerationResponse {
  created: number;
  data: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
}

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  apiKey?: string;
  apiKeys?: string[]; // Multiple keys for round-robin rotation
  baseUrl?: string;
  isEnabled: boolean;
  isAvailable: boolean;
  models: string[];
}
