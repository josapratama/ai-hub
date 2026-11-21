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

  const plainText = `${icons[severity]} *[AI Hub Alert]* ${title}\n${message}\n_Waktu: ${new Date().toLocaleString("id-ID")}_`;

  let payload: any;
  const isWaBridge = webhookUrl.includes("wabridge") || webhookUrl.includes(":18137") || webhookUrl.includes("/send");

  if (isWaBridge) {
    // WABridge WhatsApp Gateway format
    payload = {
      message: plainText,
      text: plainText,
      content: plainText,
      title,
      severity,
    };
  } else {
    // Discord, Slack, and universal JSON format
    payload = {
      content: `${icons[severity]} **[AI Hub] ${title}**\n${message}`,
      text: plainText,
      username: "AI Hub Alert Gateway",
      title,
      message,
      severity,
      timestamp: new Date().toISOString(),
      embeds: [
        {
          title: `${icons[severity]} ${title}`,
          description: message,
          color: severity === "error" ? 15158332 : severity === "warning" ? 16753920 : 3447003,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (err: any) {
    console.warn("[Webhook Alert] Failed to dispatch webhook alert:", err.message);
  }
}
