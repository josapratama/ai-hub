export const agentConfig = {
  edgeSentinelApiUrl: (process.env.EDGESENTINEL_API_URL || "https://edgesentinel.josapratama.com").replace(/\/$/, ""),
  flowmeterApiUrl: (process.env.FLOWMETER_API_URL || "http://192.168.4.1").replace(/\/$/, ""),
  waBridgeUrl: (process.env.WABRIDGE_URL || "http://localhost:3000").replace(/\/$/, ""),
  waNotifyPhone: process.env.WA_NOTIFY_PHONE || "6281234567890",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID || "",
  defaultAgentModel: process.env.DEFAULT_AGENT_MODEL || "gemini-2.0-flash",
};
