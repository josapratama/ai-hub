import { zodToJsonSchema } from "zod-to-json-schema";
import { getProjectScope } from "./registry.js";
import { memoryStore } from "./memory.js";
import { agentAnalytics } from "./analytics.js";
import { executeChatCompletion } from "../services/router.js";
import { db } from "../db.js";
import type { AgentExecutionResult, ToolCallExecution } from "./types.js";

/**
 * Intelligent Local Rule-Based Engine when no LLM API key is present or offline.
 * Ensures physical tools (CCTV, Siren, Pumps, Flowmeter) ALWAYS work!
 */
export async function fallbackLocalExecution(scopeId: string, messages: any[]): Promise<AgentExecutionResult> {
  const scope = getProjectScope(scopeId);
  const lastMsg = (messages[messages.length - 1]?.content || "").toString().toLowerCase();

  const executedTools: ToolCallExecution[] = [];
  const toolResults: Array<{ toolCallId: string; toolName: string; result: any }> = [];
  let responseText = "";

  if (lastMsg.includes("sirine") || lastMsg.includes("alarm") || lastMsg.includes("bunyikan")) {
    if (scope.tools.triggerSirenDeterrence) {
      const res = await scope.tools.triggerSirenDeterrence.execute({ duration_seconds: 5 });
      executedTools.push({ toolCallId: "call_local_1", toolName: "triggerSirenDeterrence", args: { duration_seconds: 5 }, result: res });
      toolResults.push({ toolCallId: "call_local_1", toolName: "triggerSirenDeterrence", result: res });
      responseText = "🚨 **Sirine darurat berhasil dibunyikan selama 5 detik!** Speaker telah aktif untuk menakuti penyusup.";
    }
  } else if (lastMsg.includes("kamera") || lastMsg.includes("cam")) {
    if (scope.tools.listCameras) {
      const res = await scope.tools.listCameras.execute({});
      executedTools.push({ toolCallId: "call_local_2", toolName: "listCameras", args: {}, result: res });
      toolResults.push({ toolCallId: "call_local_2", toolName: "listCameras", result: res });
      const list = (res || []).map((c: any) => `• **${c.name}** (${c.location}) — Status: \`${(c.status || "online").toUpperCase()}\``).join("\n");
      responseText = `📹 **Daftar Saluran Kamera EdgeSentinel:**\n\n${list}`;
    }
  } else if (lastMsg.includes("status") || lastMsg.includes("hardware") || lastMsg.includes("cpu")) {
    if (scope.tools.getSystemStats) {
      const res = await scope.tools.getSystemStats.execute({});
      executedTools.push({ toolCallId: "call_local_3", toolName: "getSystemStats", args: {}, result: res });
      toolResults.push({ toolCallId: "call_local_3", toolName: "getSystemStats", result: res });
      responseText = `📊 **Status Sistem CCTV Raspberry Pi:**\n\n` +
        `• Penggunaan CPU: **${res.cpu_percent}%**\n` +
        `• Penggunaan RAM: **${res.memory_percent}%** (${Math.round(res.memory_used_mb)} / ${Math.round(res.memory_total_mb)} MB)\n` +
        `• Kamera Aktif: **${res.active_cameras} Saluran**\n` +
        `• Deteksi Keamanan Hari Ini: **${res.total_events_today} Kejadian**`;
    }
  } else if (lastMsg.includes("orang") || lastMsg.includes("kejadian") || lastMsg.includes("loitering") || lastMsg.includes("asing")) {
    if (scope.tools.getRecentSecurityEvents) {
      const res = await scope.tools.getRecentSecurityEvents.execute({ limit: 3 });
      executedTools.push({ toolCallId: "call_local_4", toolName: "getRecentSecurityEvents", args: { limit: 3 }, result: res });
      toolResults.push({ toolCallId: "call_local_4", toolName: "getRecentSecurityEvents", result: res });
      const list = (res || []).map((e: any) => `• [${new Date(e.waktu).toLocaleTimeString("id-ID")}] **${e.objek}** di *${e.kamera}* ${e.loitering ? "⚠️ (Mencurigakan)" : ""}`).join("\n");
      responseText = `🚨 **Riwayat Deteksi Terkini:**\n\n${list}\n\nSemua kejadian terekam aman di NVR.`;
    }
  } else if (lastMsg.includes("foto") || lastMsg.includes("live") || lastMsg.includes("snapshot")) {
    if (scope.tools.captureLiveCameraSnapshot) {
      const res = await scope.tools.captureLiveCameraSnapshot.execute({ camera: "gerbang", inspect_with_ai: false });
      executedTools.push({ toolCallId: "call_local_5", toolName: "captureLiveCameraSnapshot", args: { camera: "gerbang" }, result: res });
      toolResults.push({ toolCallId: "call_local_5", toolName: "captureLiveCameraSnapshot", result: res });
      responseText = `📸 **Foto Live Frame Berhasil Diambil:**\n\nKamera: **${res.camera_name}**\nWaktu: ${res.captured_at}\n\n🔗 [Lihat Snapshot Real-time](${res.live_snapshot_url})`;
    }
  } else if (lastMsg.includes("liter") || lastMsg.includes("dispenser") || lastMsg.includes("flowmeter") || lastMsg.includes("solar")) {
    if (lastMsg.includes("isi") || lastMsg.includes("start")) {
      const match = lastMsg.match(/\d+/);
      const targetVal = match ? parseInt(match[0], 10) : 10;
      const isRupiah = lastMsg.includes("rp") || lastMsg.includes("ribu") || targetVal >= 1000;
      const mode = isRupiah ? "amount" : "volume";
      if (scope.tools.startFlowmeterDispense) {
        const res = await scope.tools.startFlowmeterDispense.execute({ mode, target: targetVal });
        executedTools.push({ toolCallId: "call_local_fm1", toolName: "startFlowmeterDispense", args: { mode, target: targetVal }, result: res });
        toolResults.push({ toolCallId: "call_local_fm1", toolName: "startFlowmeterDispense", result: res });
        responseText = `⛽ **Pengisian Dispenser Otomatis Dimulai:**\n\nTarget: **${targetVal} ${mode === "volume" ? "Liter" : "Rupiah"}**\nStatus: Solenoid Valve TERBUKA (Auto Cut-off Aktif).`;
      }
    } else if (lastMsg.includes("stop") || lastMsg.includes("henti")) {
      if (scope.tools.emergencyStopFlowmeter) {
        const res = await scope.tools.emergencyStopFlowmeter.execute({});
        executedTools.push({ toolCallId: "call_local_fm2", toolName: "emergencyStopFlowmeter", args: {}, result: res });
        toolResults.push({ toolCallId: "call_local_fm2", toolName: "emergencyStopFlowmeter", result: res });
        responseText = `🛑 **EMERGENCY STOP DIAKTIFKAN!**\nKatup solenoid valve langsung ditutup dan aliran fluida dihentikan.`;
      }
    } else {
      if (scope.tools.getFlowmeterStatus) {
        const res = await scope.tools.getFlowmeterStatus.execute({});
        executedTools.push({ toolCallId: "call_local_fm3", toolName: "getFlowmeterStatus", args: {}, result: res });
        toolResults.push({ toolCallId: "call_local_fm3", toolName: "getFlowmeterStatus", result: res });
        responseText = `⛽ **Status Literan Digital ESP32-S3:**\n\n• Jenis Fluida: **${res.fluid_name}**\n• Volume Batch: **${res.batch_liters} ${res.unit_name}**\n• Debit Aliran: **${res.flow_rate_lpm} L/menit**\n• Odometer Total: **${res.total_liters} Liter**\n• Katup Valve: **${res.valve_open ? "TERBUKA (MENGALIR)" : "TERTUTUP"}**`;
      }
    }
  } else if (lastMsg.includes("kebun") || lastMsg.includes("tanah") || lastMsg.includes("tani")) {
    if (scope.tools.getSoilSensorData) {
      const res = await scope.tools.getSoilSensorData.execute({ zone: "kebun_sayur" });
      executedTools.push({ toolCallId: "call_local_6", toolName: "getSoilSensorData", args: { zone: "kebun_sayur" }, result: res });
      toolResults.push({ toolCallId: "call_local_6", toolName: "getSoilSensorData", result: res });
      responseText = `🌱 **Sensor TaniCerdas (${res.zone}):**\n\n• Kelembapan Tanah: **${res.soil_moisture_percent}%**\n• Suhu Udara: **${res.air_temperature_celsius}°C**\n• Status: **${res.status}**`;
    }
  } else if (lastMsg.includes("siram")) {
    if (scope.tools.triggerIrrigationPump) {
      const res = await scope.tools.triggerIrrigationPump.execute({ zone: "kebun_sayur", duration_minutes: 5 });
      executedTools.push({ toolCallId: "call_local_7", toolName: "triggerIrrigationPump", args: { zone: "kebun_sayur", duration_minutes: 5 }, result: res });
      toolResults.push({ toolCallId: "call_local_7", toolName: "triggerIrrigationPump", result: res });
      responseText = `💧 **Pompa Irigasi Otomatis Aktif!**\nPenyiraman kebun sayur berlangsung selama 5 menit. Estimasi volume: ${res.estimated_water_liters}L air.`;
    }
  } else if (lastMsg.includes("omset") || lastMsg.includes("toko") || lastMsg.includes("jual")) {
    if (scope.tools.getSalesSummary) {
      const res = await scope.tools.getSalesSummary.execute({ period: "today" });
      executedTools.push({ toolCallId: "call_local_8", toolName: "getSalesSummary", args: { period: "today" }, result: res });
      toolResults.push({ toolCallId: "call_local_8", toolName: "getSalesSummary", result: res });
      responseText = `💰 **Laporan Penjualan Toko Hari Ini:**\n\n• Total Omset: **Rp ${res.total_revenue_idr.toLocaleString("id-ID")}**\n• Pesanan: **${res.orders_count} Transaksi**\n• Produk Terlaris: **${res.top_product}**`;
    }
  } else if (lastMsg.includes("container") || lastMsg.includes("server") || lastMsg.includes("vps") || lastMsg.includes("ping")) {
    if (scope.tools.checkContainerHealth) {
      const res = await scope.tools.checkContainerHealth.execute({});
      executedTools.push({ toolCallId: "call_local_9", toolName: "checkContainerHealth", args: {}, result: res });
      toolResults.push({ toolCallId: "call_local_9", toolName: "checkContainerHealth", result: res });
      const cList = (res || []).map((c: any) => `• **${c.name}** [${c.port}] — \`${c.status.toUpperCase()}\` (${c.uptime})`).join("\n");
      responseText = `🐳 **Status Container Server VPS:**\n\n${cList}`;
    }
  } else {
    responseText = `Halo! Saya asisten AI untuk scope **[${scope.name}]**.\n\n` +
      `Saya dapat mengeksekusi kontrol langsung untuk kamera CCTV, live snapshot, sirine alarm, literan flow meter, penyiraman kebun, omset toko, dan server VPS.\n\n` +
      `💡 *Tips:* Hubungkan API Key di tab **Providers** (Gemini, Claude, GPT, DeepSeek, Groq, OpenRouter) untuk percakapan penalaran bebas yang cerdas!`;
  }

  return {
    role: "assistant",
    content: responseText,
    toolCalls: executedTools,
    toolResults,
    finishReason: "stop",
    modelUsed: "local-engine",
    providerUsed: "local-rule-engine",
    durationMs: 40,
  };
}

/**
 * Executes multi-step tool reasoning with configured LLMs in AI Hub
 */
export async function executeAgentChat({
  project = "cctv",
  messages = [],
  modelPreference,
}: {
  project?: string;
  messages: Array<{ role: string; content: string }>;
  modelPreference?: string;
}): Promise<AgentExecutionResult> {
  const startTime = Date.now();
  agentAnalytics.incrementRequests();
  const scope = getProjectScope(project);

  // Check if any AI provider is available in AI Hub
  const providers = db.getProviders();
  const hasActiveProvider = Object.values(providers).some(
    p => (p.isEnabled && p.apiKey && p.apiKey.length > 5) || (p.id === "ollama" && p.isEnabled)
  );

  if (!hasActiveProvider) {
    return await fallbackLocalExecution(project, messages);
  }

  // Model selection
  const targetModel = modelPreference || db.getSettings().defaultModel || "gemini-2.0-flash";

  // Build tools schema catalog for the prompt
  const toolDefinitions = Object.entries(scope.tools).map(([name, t]) => {
    let schema: any = {};
    try {
      schema = zodToJsonSchema(t.parameters as any);
    } catch {}
    return {
      name,
      description: t.description,
      parameters: schema,
    };
  });

  const memoryContext = memoryStore.getPromptContext();
  const toolsPromptSection = `
[DAFTAR TOOLS YANG DAPAT ANDA PANGGIL]:
${JSON.stringify(toolDefinitions, null, 2)}

[ATURAN PENGGUNAAN TOOLS]:
1. Jika pengguna meminta aksi atau data yang disediakan oleh salah satu tool di atas (misal: cek kamera, status cctv, foto live, sirine, isi bensin, literan, siram kebun, cek omset, cek server, simpan memori), Anda WAJIB memanggil tool tersebut terlebih dahulu.
2. Untuk memanggil tool, berikan respons HANYA berupa satu blok JSON terformat berikut tanpa teks tambahan di luar blok:
\`\`\`json
{
  "action": "call_tool",
  "tool": "NAMA_TOOL",
  "parameters": { ...argumen sesuai schema... }
}
\`\`\`
3. Jika Anda sudah menerima hasil eksekusi tool ([HASIL EKSEKUSI TOOL]), atau jika pertanyaan pengguna adalah percakapan biasa yang tidak memerlukan tool, jawablah pengguna secara ramah, lengkap, dan profesional dalam Bahasa Indonesia tanpa blok JSON.
`.trim();

  const fullSystemPrompt = `${scope.systemPrompt}${memoryContext}\n\n${toolsPromptSection}`;

  // Prepare context messages
  const workingMessages: Array<{ role: string; content: string }> = [
    { role: "system", content: fullSystemPrompt },
    ...messages,
  ];

  const executedToolCalls: ToolCallExecution[] = [];
  const toolResults: Array<{ toolCallId: string; toolName: string; result: any }> = [];
  let currentStep = 0;
  const maxSteps = 4;
  let finalResponseText = "";
  let finalModelUsed = targetModel;
  let finalProviderUsed = "";

  while (currentStep < maxSteps) {
    currentStep++;
    let executionResult;

    try {
      executionResult = await executeChatCompletion({
        model: targetModel,
        messages: workingMessages as any,
        temperature: 0.2,
      }, undefined, `agent-${scope.id}`);
    } catch (err) {
      console.warn(`[Agent LLM call error at step ${currentStep}]:`, err);
      // Fallback to local rule engine
      return await fallbackLocalExecution(project, messages);
    }

    finalModelUsed = executionResult.modelUsed;
    finalProviderUsed = executionResult.providerUsed;
    const assistantMsg = executionResult.response?.choices?.[0]?.message?.content || "";

    // Check if the assistant wants to call a tool
    const jsonMatch = assistantMsg.match(/```json\s*(\{[\s\S]*?\})\s*```/) || assistantMsg.match(/(\{\s*"action"\s*:\s*"call_tool"[\s\S]*?\})/);

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.action === "call_tool" && parsed.tool) {
          const toolName = parsed.tool;
          const toolArgs = parsed.parameters || {};
          const toolInstance = scope.tools[toolName];

          if (toolInstance) {
            const callId = `call_${Date.now()}_${currentStep}`;
            const toolResult = await toolInstance.execute(toolArgs);

            executedToolCalls.push({
              toolCallId: callId,
              toolName,
              args: toolArgs,
              result: toolResult,
            });

            toolResults.push({
              toolCallId: callId,
              toolName,
              result: toolResult,
            });

            // Append assistant tool intent and tool result to context
            workingMessages.push({
              role: "assistant",
              content: assistantMsg,
            });

            workingMessages.push({
              role: "user",
              content: `[HASIL EKSEKUSI TOOL "${toolName}"]: ${JSON.stringify(toolResult, null, 2)}\n\nBerdasarkan hasil eksekusi tool di atas, berikan jawaban akhir yang ramah, informatif, dan terstruktur untuk pengguna dalam Bahasa Indonesia.`,
            });

            continue; // Proceed to next step to synthesize final answer
          }
        }
      } catch (parseErr) {
        console.warn("[Agent Tool Parse Error]:", parseErr);
      }
    }

    // No tool call or final text reached
    finalResponseText = assistantMsg;
    break;
  }

  // If loop exhausted with tool executed but no text
  if (!finalResponseText && executedToolCalls.length > 0) {
    const lastResult = toolResults[toolResults.length - 1];
    finalResponseText = `Aksi **${lastResult.toolName}** telah selesai dieksekusi dengan hasil:\n\`\`\`json\n${JSON.stringify(lastResult.result, null, 2)}\n\`\`\``;
  }

  const durationMs = Date.now() - startTime;

  return {
    role: "assistant",
    content: finalResponseText,
    toolCalls: executedToolCalls,
    toolResults,
    finishReason: "stop",
    modelUsed: finalModelUsed,
    providerUsed: finalProviderUsed,
    durationMs,
  };
}
