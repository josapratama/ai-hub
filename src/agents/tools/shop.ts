import { z } from "zod";
import { agentAnalytics } from "../analytics.js";
import type { AgentTool } from "../types.js";

export const shopTools: Record<string, AgentTool> = {
  getSalesSummary: {
    name: "getSalesSummary",
    description: "Mendapatkan laporan penjualan toko: omset hari ini, jumlah pesanan, dan pesanan yang menunggu proses.",
    parameters: z.object({
      period: z.enum(["today", "yesterday", "this_month"]).default("today").describe("Periode laporan penjualan"),
    }),
    execute: async ({ period }: any) => {
      const start = Date.now();
      const p = period || "today";
      const result = {
        period: p,
        total_revenue_idr: 3450000,
        orders_count: 24,
        pending_fulfillment: 3,
        average_order_value_idr: 143750,
        top_product: "Sensor ESP32-S3 IoT Module",
      };
      agentAnalytics.recordToolExecution({
        project: "shop",
        toolName: "getSalesSummary",
        status: "success",
        durationMs: Date.now() - start,
        details: `Period: ${p}, Orders: 24`,
      });
      return result;
    },
  },

  checkProductStock: {
    name: "checkProductStock",
    description: "Memeriksa sisa stok barang di gudang atau produk yang mendekati habis (low stock alert).",
    parameters: z.object({
      search: z.string().optional().describe("Nama produk yang ingin dicek"),
    }),
    execute: async ({ search }: any) => {
      const start = Date.now();
      const inventory = [
        { sku: "ESP-S3-01", name: "ESP32-S3 N16R8 Camera Board", stock: 42, min_threshold: 10, status: "in_stock" },
        { sku: "PWR-5V-02", name: "Power Supply 5V 4A Raspberry Pi", stock: 4, min_threshold: 10, status: "low_stock" },
        { sku: "CAM-NOIR-03", name: "Night Vision IR Camera Ribbon", stock: 18, min_threshold: 5, status: "in_stock" },
        { sku: "SOL-12V-04", name: "Solenoid Valve 1/2 Inch DC 12V", stock: 2, min_threshold: 5, status: "critical_low" },
      ];
      const filtered = search
        ? inventory.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.sku.toLowerCase().includes(search.toLowerCase()))
        : inventory;

      agentAnalytics.recordToolExecution({
        project: "shop",
        toolName: "checkProductStock",
        status: "success",
        durationMs: Date.now() - start,
        details: `Checked stock: ${filtered.length} items`,
      });
      return filtered;
    },
  },
};

export const shopSystemPrompt = `
Anda adalah "Niaga AI", asisten operasional toko online Rusty Shop & POS.
Anda dapat memberikan rekap omset harian, jumlah pesanan, dan mendeteksi produk yang stoknya menipis di gudang.
Gunakan Bahasa Indonesia yang ramah, ringkas, dan fokus pada efisiensi bisnis.
`.trim();
