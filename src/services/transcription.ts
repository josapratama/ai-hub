import { db } from "../db.js";
import { getRotatedKey } from "./pricing.js";

export interface TranscriptionParams {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  model?: string;
}

export async function transcribeAudio(params: {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  model?: string;
}): Promise<{ text: string }> {
  const providers = db.getProviders();
  const requestedModel = (params.model || "").toLowerCase();

  // 1. Try OpenAI Whisper if explicitly requested or if OpenAI configured
  if (requestedModel.includes("whisper") || requestedModel.startsWith("openai")) {
    const oaiConfig = providers.openai;
    const oaiKey = getRotatedKey("openai", oaiConfig?.apiKey, oaiConfig?.apiKeys);
    if (oaiKey) {
      try {
        const formData = new FormData();
        formData.append("file", new Blob([new Uint8Array(params.buffer)], { type: params.mimeType }), params.filename);
        formData.append("model", "whisper-1");

        const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${oaiKey}`,
          },
          body: formData,
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          return { text: data.text || "" };
        }
      } catch (err) {
        console.warn("[Transcription] OpenAI Whisper failed, falling back to Gemini:", err);
      }
    }
  }

  // 2. Default: Google Gemini 2.0 Flash (Fast, Native Multimodal Audio)
  const gemConfig = providers.gemini;
  const gemKey = getRotatedKey("gemini", gemConfig?.apiKey, gemConfig?.apiKeys);
  if (!gemKey) {
    throw new Error("Neither Google Gemini nor OpenAI API keys are configured for audio transcription.");
  }

  const base64Audio = params.buffer.toString("base64");
  let mimeType = params.mimeType;
  if (!mimeType || mimeType === "application/octet-stream") {
    if (params.filename.endsWith(".wav")) mimeType = "audio/wav";
    else if (params.filename.endsWith(".m4a")) mimeType = "audio/m4a";
    else if (params.filename.endsWith(".ogg")) mimeType = "audio/ogg";
    else if (params.filename.endsWith(".webm")) mimeType = "audio/webm";
    else mimeType = "audio/mp3";
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${gemKey}`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: "Transcribe this audio recording accurately into text. Output only the transcribed speech, without any additional comments, timestamps, or conversational filler.",
          },
          {
            inlineData: {
              mimeType,
              data: base64Audio,
            },
          },
        ],
      },
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini audio transcription error (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as any;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return { text: text.trim() };
}
