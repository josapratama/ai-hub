import crypto from "crypto";
import type { ChatCompletionResponse } from "../types.js";

interface CacheEntry {
  response: ChatCompletionResponse;
  expiresAt: number;
}

const responseCache = new Map<string, CacheEntry>();

// Clean expired cache every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of responseCache.entries()) {
    if (now > entry.expiresAt) {
      responseCache.delete(key);
    }
  }
}, 10 * 60 * 1000);

export function generateCacheKey(model: string, messages: any[]): string {
  const hash = crypto.createHash("sha256");
  hash.update(model);
  hash.update(JSON.stringify(messages));
  return hash.digest("hex");
}

export function getCachedResponse(key: string): ChatCompletionResponse | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return entry.response;
}

export function setCachedResponse(
  key: string,
  response: ChatCompletionResponse,
  ttlSeconds: number = 600 // default 10 minutes
) {
  responseCache.set(key, {
    response,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}
