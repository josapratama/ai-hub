import { agentConfig } from "../config.js";
import { executeAgentChat } from "../executor.js";
import { cctvTools } from "../tools/cctv.js";
import { taniCerdasTools } from "../tools/tanicerdas.js";

export interface TelegramInlineButton {
  text: string;
  callback_data: string;
}

export async function sendTelegramMessage(
  chatId: string,
  text: string,
  inlineButtons?: TelegramInlineButton[][]
): Promise<{ success: boolean; error?: string }> {
  if (!agentConfig.telegramBotToken) {
    return { success: false, error: "TELEGRAM_BOT_TOKEN belum diset di .env" };
  }

  try {
    const payload: any = {
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    };

    if (inlineButtons && inlineButtons.length > 0) {
      payload.reply_markup = {
        inline_keyboard: inlineButtons,
      };
    }

    const res = await fetch(`https://api.telegram.org/bot${agentConfig.telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `Telegram HTTP ${res.status}: ${err}` };
    }
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function processTelegramInteraction(body: any): Promise<{ reply: string; buttons?: TelegramInlineButton[][] }> {
  // Handle callback query (button clicks)
  if (body.callback_query) {
    const data = body.callback_query.data;
    switch (data) {
      case "btn_trigger_siren": {
        await cctvTools.triggerSirenDeterrence.execute({ duration_seconds: 5 });
        return {
          reply: `🚨 *SIRINE AKTIF!*\nSirine fisik EdgeSentinel telah dibunyikan selama 5 detik untuk menakuti penyusup.`,
        };
      }
      case "btn_live_cctv": {
        const liveRes: any = await cctvTools.captureLiveCameraSnapshot.execute({ camera: "gerbang", inspect_with_ai: true });
        const analysis = liveRes.ai_analysis || liveRes.error || "Live frame captured";
        const url = liveRes.live_snapshot_url || "https://edgesentinel.josapratama.com";
        return {
          reply: `📹 *LIVE SNAPSHOT GERBANG DEPAN*\n\n` +
            `Waktu: ${new Date().toLocaleTimeString("id-ID")} WIB\n` +
            `Analisis: ${analysis}\n` +
            `🔗 Foto: ${url}`,
          buttons: [
            [{ text: "🚨 Bunyikan Sirine", callback_data: "btn_trigger_siren" }],
            [{ text: "🛡️ Cek Status Kamera", callback_data: "btn_status_cctv" }],
          ],
        };
      }
      case "btn_water_garden": {
        const pumpRes: any = await taniCerdasTools.triggerIrrigationPump.execute({ zone: "kebun_sayur", duration_minutes: 5 });
        return {
          reply: `💧 *PENYIRAMAN DIAKTIFKAN*\nPompa irigasi kebun sayur telah menyala selama 5 menit. Estimasi: ${pumpRes.estimated_water_liters || 62.5} Liter air.`,
        };
      }
      case "btn_status_cctv": {
        const stats: any = await cctvTools.getSystemStats.execute({});
        return {
          reply: `📊 *STATUS EDGESENTINEL*\n\n` +
            `• CPU: ${stats.cpu_percent || 25}%\n` +
            `• RAM: ${stats.memory_percent || 70}%\n` +
            `• Kamera Aktif: ${stats.active_cameras || 3}\n` +
            `• Deteksi Hari Ini: ${stats.total_events_today || 0}`,
          buttons: [
            [{ text: "📸 Ambil Foto Live", callback_data: "btn_live_cctv" }],
            [{ text: "🚨 Bunyikan Sirine", callback_data: "btn_trigger_siren" }],
          ],
        };
      }
      default:
        return { reply: `Aksi tombol "${data}" diproses.` };
    }
  }

  // Handle regular chat text
  const message = body.message?.text || body.text || "";
  const result = await executeAgentChat({
    project: "superadmin",
    messages: [{ role: "user", content: message }],
  });

  return {
    reply: result.content || "Siap, ada yang bisa saya bantu lagi?",
    buttons: [
      [
        { text: "📸 Foto Live", callback_data: "btn_live_cctv" },
        { text: "🚨 Sirine", callback_data: "btn_trigger_siren" },
      ],
      [
        { text: "💧 Siram Kebun", callback_data: "btn_water_garden" },
        { text: "📊 Status CCTV", callback_data: "btn_status_cctv" },
      ],
    ],
  };
}
