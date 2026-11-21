import { agentConfig } from "../config.js";
import { executeAgentChat } from "../executor.js";
import { agentAnalytics } from "../analytics.js";

export async function sendWhatsAppMessage(to: string, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${agentConfig.waBridgeUrl}/api/messages/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        message,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { success: false, error: `WABridge returned HTTP ${res.status}: ${errText}` };
    }
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Gagal menghubungi WABridge di ${agentConfig.waBridgeUrl}: ${msg}` };
  }
}

export async function processInboundWhatsAppMessage(from: string, userText: string): Promise<string> {
  agentAnalytics.incrementRequests();
  try {
    const result = await executeAgentChat({
      project: "superadmin",
      messages: [{ role: "user", content: userText }],
    });

    const reply = result.content || "Maaf, saya tidak dapat memproses permintaan tersebut.";

    // Attempt to send back via WABridge
    await sendWhatsAppMessage(from, reply);

    return reply;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const fallbackReply = `⚠️ *AI Hub Omni Agent Error:*\n${errorMsg}`;
    await sendWhatsAppMessage(from, fallbackReply);
    return fallbackReply;
  }
}

export async function dispatchProactiveSecurityAlert({
  cameraName,
  objectClass,
  isLoitering,
  snapshotUrl,
  timestamp,
}: {
  cameraName: string;
  objectClass: string;
  isLoitering: boolean;
  snapshotUrl?: string;
  timestamp?: string;
}) {
  const time = timestamp || new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const loiteringAlert = isLoitering ? "⚠️ *TERDETEKSI LOITERING / MENCURIGAKAN!*" : "";

  const text = [
    `🚨 *EDGESENTINEL SECURITY ALERT* 🚨`,
    `--------------------------------------`,
    `📹 Kamera: *${cameraName}*`,
    `🎯 Objek: *${objectClass.toUpperCase()}*`,
    loiteringAlert,
    `🕒 Waktu: ${time} WIB`,
    snapshotUrl ? `📷 Foto Snapshot: ${snapshotUrl}` : "",
    `--------------------------------------`,
    `💡 *Tips:* Balas pesan ini dengan *"bunyikan sirine"* untuk mengaktifkan alarm pencegahan, atau *"cek cctv"* untuk melihat status terkini.`,
  ].filter(Boolean).join("\n");

  const waResult = await sendWhatsAppMessage(agentConfig.waNotifyPhone, text);

  agentAnalytics.recordSecurityAlert({
    cameraName,
    objectClass,
    isLoitering,
    snapshotUrl,
    summary: `Deteksi ${objectClass} di ${cameraName}`,
    dispatchedToWA: waResult.success,
  });

  return {
    alertSent: true,
    dispatchedToWA: waResult.success,
    waError: waResult.error,
    message: text,
  };
}
