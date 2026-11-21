import crypto from "crypto";
import { db } from "../db.js";
import { getRotatedKey } from "./pricing.js";

export interface SpeechRequest {
  model?: string;
  input: string;
  voice?: string;
  response_format?: string;
  speed?: number;
}

interface CachedAudio {
  buffer: Buffer;
  contentType: string;
  cachedAt: number;
}

const audioCache = new Map<string, CachedAudio>();
const MAX_CACHE_ENTRIES = 100;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function generateSpeech(req: SpeechRequest): Promise<{ buffer: Buffer; contentType: string; isCached?: boolean }> {
  if (!req.input || req.input.trim() === "") {
    throw new Error("Missing required field: 'input' must not be empty.");
  }

  // Check audio cache
  const cacheKey = crypto
    .createHash("md5")
    .update(`${req.model || "tts-1"}:${req.voice || "alloy"}:${req.speed || 1}:${req.response_format || "mp3"}:${req.input.trim()}`)
    .digest("hex");

  const cached = audioCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return {
      buffer: cached.buffer,
      contentType: cached.contentType,
      isCached: true,
    };
  }

  const providers = db.getProviders();
  const oaiConfig = providers.openai;
  const oaiKey = getRotatedKey("openai", oaiConfig?.apiKey, oaiConfig?.apiKeys);

  const setCache = (buffer: Buffer, contentType: string) => {
    if (audioCache.size >= MAX_CACHE_ENTRIES) {
      const firstKey = audioCache.keys().next().value;
      if (firstKey) audioCache.delete(firstKey);
    }
    audioCache.set(cacheKey, { buffer, contentType, cachedAt: Date.now() });
  };

  // 1. If OpenAI is configured, use OpenAI TTS-1
  if (oaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${oaiKey}`,
        },
        body: JSON.stringify({
          model: req.model || "tts-1",
          input: req.input,
          voice: req.voice || "alloy",
          response_format: req.response_format || "mp3",
          speed: req.speed || 1.0,
        }),
      });

      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const contentType = res.headers.get("content-type") || "audio/mpeg";
        const buffer = Buffer.from(arrayBuf);
        setCache(buffer, contentType);
        return {
          buffer,
          contentType,
          isCached: false,
        };
      }
    } catch (err) {
      console.warn("[TTS] OpenAI TTS failed, falling back to free TTS:", err);
    }
  }

  // 2. Fallback: Google Translate TTS (Free, zero-key dependency)
  const encodedText = encodeURIComponent(req.input.slice(0, 500));
  const fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=id&client=tw-ob&q=${encodedText}`;

  const fbRes = await fetch(fallbackUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
  });

  if (!fbRes.ok) {
    throw new Error(`Text-to-speech fallback service failed (${fbRes.status})`);
  }

  const arrayBuf = await fbRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);
  const contentType = "audio/mpeg";
  setCache(buffer, contentType);

  return {
    buffer,
    contentType,
    isCached: false,
  };
}
