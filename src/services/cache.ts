import crypto from "crypto";
import type { ChatCompletionResponse } from "../types.js";

interface CacheEntry {
  response: ChatCompletionResponse;
  expiresAt: number;
  tokens: number;
  costUsd: number;
}

const responseCache = new Map<string, CacheEntry>();

let cacheHits = 0;
let cacheMisses = 0;
let tokensSaved = 0;
let costSavedUsd = 0;

// Clean expired cache every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of responseCache.entries()) {
    if (now > entry.expiresAt) {
      responseCache.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Normalizes message contents for higher cache hit rate
 */
function normalizeMessages(messages: any[]): any[] {
  if (!Array.isArray(messages)) return [];
  return messages.map(m => {
    if (typeof m.content === "string") {
      return { role: m.role, content: m.content.trim() };
    }
    return m;
  });
}

export function generateCacheKey(model: string, messages: any[]): string {
  const hash = crypto.createHash("sha256");
  hash.update(model.trim().toLowerCase());
  hash.update(JSON.stringify(normalizeMessages(messages)));
  return hash.digest("hex");
}

export function getCachedResponse(key: string): ChatCompletionResponse | null {
  const entry = responseCache.get(key);
  if (!entry) {
    cacheMisses++;
    return null;
  }
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    cacheMisses++;
    return null;
  }
  cacheHits++;
  tokensSaved += entry.tokens;
  costSavedUsd += entry.costUsd;
  return entry.response;
}

export function setCachedResponse(
  key: string,
  response: ChatCompletionResponse,
  ttlSeconds: number = 600, // default 10 minutes
  tokens: number = 0,
  costUsd: number = 0
) {
  responseCache.set(key, {
    response,
    expiresAt: Date.now() + ttlSeconds * 1000,
    tokens: tokens || (response.usage?.total_tokens || 0),
    costUsd: costUsd || 0,
  });
}

export function getCacheMetrics() {
  const totalQueries = cacheHits + cacheMisses;
  const hitRatio = totalQueries > 0 ? Number(((cacheHits / totalQueries) * 100).toFixed(1)) : 0;
  return {
    size: responseCache.size,
    hits: cacheHits,
    misses: cacheMisses,
    hitRatio,
    tokensSaved,
    costSavedUsd: Number(costSavedUsd.toFixed(6)),
  };
}

export function clearCache() {
  const size = responseCache.size;
  responseCache.clear();
  return { clearedEntries: size };
}

export function resetCacheMetrics() {
  cacheHits = 0;
  cacheMisses = 0;
  tokensSaved = 0;
  costSavedUsd = 0;
  return true;
}
