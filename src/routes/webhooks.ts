import { Router, type Request, type Response } from "express";
import { processInboundWhatsAppMessage, dispatchProactiveSecurityAlert } from "../agents/services/whatsapp.js";
import { processTelegramInteraction, sendTelegramMessage } from "../agents/services/telegram.js";

export const webhooksRouter = Router();

/**
 * WhatsApp Inbound Webhook (from WABridge)
 */
webhooksRouter.post("/whatsapp", async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, message } = req.body || {};
    if (!from || !message) {
      res.status(400).json({ error: "Parameter 'from' dan 'message' wajib diisi." });
      return;
    }

    const reply = await processInboundWhatsAppMessage(from, message);
    res.json({ status: "ok", replied: true, reply });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

/**
 * Telegram Inbound Webhook
 */
webhooksRouter.post("/telegram", async (req: Request, res: Response): Promise<void> => {
  try {
    const interaction = await processTelegramInteraction(req.body);
    const chatId = req.body?.message?.chat?.id || req.body?.callback_query?.message?.chat?.id;

    if (chatId) {
      await sendTelegramMessage(String(chatId), interaction.reply, interaction.buttons);
    }

    res.json({ status: "ok", interaction });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

/**
 * Proactive Security Alert Webhook (from EdgeSentinel CCTV)
 */
webhooksRouter.post("/security-alert", async (req: Request, res: Response): Promise<void> => {
  try {
    const { camera_name, object_class, is_loitering, snapshot_url, timestamp } = req.body || {};

    if (!camera_name || !object_class) {
      res.status(400).json({ error: "Parameter 'camera_name' dan 'object_class' wajib diisi." });
      return;
    }

    const result = await dispatchProactiveSecurityAlert({
      cameraName: camera_name,
      objectClass: object_class,
      isLoitering: Boolean(is_loitering),
      snapshotUrl: snapshot_url,
      timestamp,
    });

    res.json({ status: "ok", result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});
