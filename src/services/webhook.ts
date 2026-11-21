import { db } from "../db.js";

export async function sendWebhookAlert(
  title: string,
  message: string,
  severity: "info" | "warning" | "error" = "info"
) {
  const settings = db.getSettings();
  const webhookUrl = (settings as any).webhookUrl;
  if (!webhookUrl || typeof webhookUrl !== "string" || !webhookUrl.startsWith("http")) {
    return; // webhook not configured
  }

  const icons = {
    info: "ℹ️",
    warning: "⚠️",
    error: "🚨",
  };

  const payload = {
    content: `${icons[severity]} **[AI Hub] ${title}**\n${message}`,
    username: "AI Hub Alert Gateway",
    embeds: [
      {
        title: `${icons[severity]} ${title}`,
        description: message,
        color: severity === "error" ? 15158332 : severity === "warning" ? 16753920 : 3447003,
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    console.warn("[Webhook Alert] Failed to dispatch webhook:", err.message);
  }
}
