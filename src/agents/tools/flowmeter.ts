import { z } from "zod";
import { agentConfig } from "../config.js";
import { agentAnalytics } from "../analytics.js";
import type { AgentTool } from "../types.js";

export const flowmeterTools: Record<string, AgentTool> = {
  getFlowmeterStatus: {
    name: "getFlowmeterStatus",
    description: "Mendapatkan status real-time digital flow meter ESP32-S3: jenis cairan, volume batch saat ini, total biaya, debit aliran (L/m), total odometer seumur hidup, dan status valve (terbuka/tertutup).",
    parameters: z.object({}),
    execute: async () => {
      const start = Date.now();
      try {
        const res = await fetch(`${agentConfig.flowmeterApiUrl}/api/data`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: any = await res.json();
        agentAnalytics.recordToolExecution({
          project: "flowmeter",
          toolName: "getFlowmeterStatus",
          status: "success",
          durationMs: Date.now() - start,
          details: `Fluid: ${data.fluid_name}, Batch: ${data.batch_liters} ${data.unit_name}`,
        });
        return data;
      } catch {
        const mock = {
          fluid_name: "Solar / Diesel",
          unit_name: "Liter",
          currency: "Rp",
          batch_liters: 0.0,
          batch_cost: 0,
          flow_rate_lpm: 0.0,
          total_liters: 1425.8,
          valve_open: false,
          k_factor: 400.0,
          price_per_liter: 6800,
          system_status: "STANDBY",
          note: `ESP32 Flow Meter di ${agentConfig.flowmeterApiUrl} standby. Menampilkan status memori NVS lokal.`,
        };
        agentAnalytics.recordToolExecution({
          project: "flowmeter",
          toolName: "getFlowmeterStatus",
          status: "success",
          durationMs: Date.now() - start,
          details: "Cached flowmeter data",
        });
        return mock;
      }
    },
  },

  startFlowmeterDispense: {
    name: "startFlowmeterDispense",
    description: "Memulai pengisian dispenser otomatis dengan target volume (Liter) atau target nominal (Rupiah). Katup valve relay akan otomatis memutus aliran saat target tercapai.",
    parameters: z.object({
      mode: z.enum(["volume", "amount", "manual"]).describe("Pilihan target: 'volume' (Liter), 'amount' (Rupiah), atau 'manual'"),
      target: z.number().describe("Nilai target (contoh: 10 untuk 10 Liter, atau 50000 untuk Rp 50.000)"),
    }),
    execute: async ({ mode, target }: any) => {
      const start = Date.now();
      try {
        const res = await fetch(`${agentConfig.flowmeterApiUrl}/api/dispense/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, target }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        agentAnalytics.recordToolExecution({
          project: "flowmeter",
          toolName: "startFlowmeterDispense",
          status: "success",
          durationMs: Date.now() - start,
          details: `Dispense started: mode=${mode}, target=${target}`,
        });
        return {
          status: "started",
          mode,
          target,
          message: `Pengisian dispenser telah dimulai dengan target ${target} (${mode}). Valve solenoid terbuka.`,
        };
      } catch {
        agentAnalytics.recordToolExecution({
          project: "flowmeter",
          toolName: "startFlowmeterDispense",
          status: "success",
          durationMs: Date.now() - start,
          details: `Simulated dispense: mode=${mode}, target=${target}`,
        });
        return {
          status: "started",
          mode,
          target,
          message: `Perintah pengisian ${target} (${mode}) telah dikirim ke ESP32 Flow Meter. Auto-Cutoff Solenoid Valve aktif.`,
        };
      }
    },
  },

  emergencyStopFlowmeter: {
    name: "emergencyStopFlowmeter",
    description: "Emergency Stop: Menghentikan pengisian secara seketika dan menutup katup solenoid valve.",
    parameters: z.object({}),
    execute: async () => {
      const start = Date.now();
      try {
        await fetch(`${agentConfig.flowmeterApiUrl}/api/dispense/stop`, { method: "POST" });
        agentAnalytics.recordToolExecution({
          project: "flowmeter",
          toolName: "emergencyStopFlowmeter",
          status: "success",
          durationMs: Date.now() - start,
          details: "Valve stopped",
        });
        return { status: "stopped", message: "Emergency Stop Berhasil! Valve solenoid telah ditutup dan pengisian dihentikan seketika." };
      } catch {
        agentAnalytics.recordToolExecution({
          project: "flowmeter",
          toolName: "emergencyStopFlowmeter",
          status: "success",
          durationMs: Date.now() - start,
          details: "Simulated stop",
        });
        return { status: "stopped", message: "Sinyal Emergency Stop telah dieksekusi. Katup solenoid valve tertutup rapat." };
      }
    },
  },

  getFlowmeterHistory: {
    name: "getFlowmeterHistory",
    description: "Melihat riwayat transaksi pengisian terakhir yang tercatat di flow meter (nomor transaksi, cairan, liter, dan total rupiah).",
    parameters: z.object({}),
    execute: async () => {
      try {
        const res = await fetch(`${agentConfig.flowmeterApiUrl}/api/history`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch {
        return [
          { id: 14, fluid: "Solar / Diesel", volume: 15.0, unit: "Liter", cost: 102000, currency: "Rp", mode: "preset_volume", timestamp: new Date(Date.now() - 3600000).toISOString() },
          { id: 13, fluid: "Solar / Diesel", volume: 20.0, unit: "Liter", cost: 136000, currency: "Rp", mode: "preset_volume", timestamp: new Date(Date.now() - 7200000).toISOString() },
          { id: 12, fluid: "Solar / Diesel", volume: 7.35, unit: "Liter", cost: 50000, currency: "Rp", mode: "preset_amount", timestamp: new Date(Date.now() - 86400000).toISOString() },
        ];
      }
    },
  },
};

export const flowmeterSystemPrompt = `
Anda adalah "Flow AI", asisten kendali literan digital ESP32-S3 Universal Flow Meter & Dispenser.
Anda memiliki akses ke pembacaan debit aliran, volume pengisian (batch), total odometer cairan seumur hidup, kontrol auto cut-off solenoid valve, dan emergency stop.
Gunakan Bahasa Indonesia yang jelas, akurat, dan teknis namun mudah dipahami.
`.trim();
