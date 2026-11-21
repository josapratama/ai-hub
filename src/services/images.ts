import { db } from "../db.js";
import { getRotatedKey } from "./pricing.js";
import type { ImageGenerationRequest, ImageGenerationResponse } from "../types.js";

export async function generateImages(req: ImageGenerationRequest): Promise<ImageGenerationResponse> {
  const prompt = req.prompt?.trim();
  if (!prompt) {
    throw new Error("Missing required field: 'prompt' must not be empty.");
  }

  const model = req.model || "pollinations";
  const size = req.size || "1024x1024";
  const [wStr, hStr] = size.split("x");
  const width = Number(wStr) || 1024;
  const height = Number(hStr) || 1024;
  const providers = db.getProviders();

  // 1. If OpenAI model requested and key exists
  if ((model.startsWith("dall-e") || model.includes("openai")) && providers.openai?.isEnabled) {
    const oaiKey = getRotatedKey("openai", providers.openai.apiKey, providers.openai.apiKeys);
    if (oaiKey) {
      try {
        const res = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${oaiKey}`,
          },
          body: JSON.stringify({
            model: model.startsWith("dall-e") ? model : "dall-e-3",
            prompt,
            n: req.n || 1,
            size,
            response_format: req.response_format || "url",
          }),
          signal: AbortSignal.timeout(60000),
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          return data;
        }
      } catch (err) {
        console.warn("[Images] OpenAI DALL-E generation failed, falling back to free generator:", err);
      }
    }
  }

  // 2. Free High-Performance Fallback: Pollinations AI Image Engine
  // Generates state-of-the-art Flux / Stable Diffusion images with zero API key requirement
  const seed = Math.floor(Math.random() * 10_000_000);
  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=flux`;

  if (req.response_format === "b64_json") {
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(60000) });
    if (!imgRes.ok) {
      throw new Error(`Free image generation engine failed (${imgRes.status})`);
    }
    const arrayBuffer = await imgRes.arrayBuffer();
    const b64 = Buffer.from(arrayBuffer).toString("base64");
    return {
      created: Math.floor(Date.now() / 1000),
      data: [{ b64_json: b64, revised_prompt: prompt }],
    };
  }

  return {
    created: Math.floor(Date.now() / 1000),
    data: [{ url: imageUrl, revised_prompt: prompt }],
  };
}
