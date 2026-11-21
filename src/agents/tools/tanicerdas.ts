import { z } from "zod";
import { agentAnalytics } from "../analytics.js";
import type { AgentTool } from "../types.js";

export const taniCerdasTools: Record<string, AgentTool> = {
  getSoilSensorData: {
    name: "getSoilSensorData",
    description: "Membaca kondisi sensor tanah kebun: kelembapan tanah (%), suhu udara (°C), kelembapan udara (RH), dan pH tanah.",
    parameters: z.object({
      zone: z.enum(["greenhouse_1", "kebun_sayur", "taman_depan"]).default("kebun_sayur").describe("Zona sensor kebun"),
    }),
    execute: async ({ zone }: any) => {
      const start = Date.now();
      const hour = new Date().getHours();
      const moisture = Math.round(54 + Math.sin(hour) * 12);
      const temp = Math.round(28 + Math.cos(hour) * 3);

      const result = {
        zone: zone || "kebun_sayur",
        soil_moisture_percent: moisture,
        air_temperature_celsius: temp,
        air_humidity_rh: 72,
        soil_ph: 6.5,
        status: moisture < 50 ? "butuh_penyiraman" : "optimal",
        last_updated: new Date().toISOString(),
      };

      agentAnalytics.recordToolExecution({
        project: "tanicerdas",
        toolName: "getSoilSensorData",
        status: "success",
        durationMs: Date.now() - start,
        details: `Zone: ${result.zone}, Moisture: ${moisture}%`,
      });
      return result;
    },
  },

  triggerIrrigationPump: {
    name: "triggerIrrigationPump",
    description: "Mengaktifkan pompa air irigasi otomatis (solenoid valve) untuk menyiram kebun selama durasi tertentu.",
    parameters: z.object({
      zone: z.enum(["greenhouse_1", "kebun_sayur", "taman_depan"]).describe("Zona yang ingin disiram"),
      duration_minutes: z.number().default(5).describe("Durasi penyiraman dalam menit (1-30 menit)"),
    }),
    execute: async ({ zone, duration_minutes }: any) => {
      const start = Date.now();
      const mins = duration_minutes || 5;
      const targetZone = zone || "kebun_sayur";
      const result = {
        status: "pump_activated",
        zone: targetZone,
        duration_minutes: mins,
        water_flow_rate_lpm: 12.5,
        estimated_water_liters: mins * 12.5,
        started_at: new Date().toISOString(),
      };
      agentAnalytics.recordToolExecution({
        project: "tanicerdas",
        toolName: "triggerIrrigationPump",
        status: "success",
        durationMs: Date.now() - start,
        details: `Pump ON in ${targetZone} for ${mins}m`,
      });
      return result;
    },
  },

  getWeatherForecast: {
    name: "getWeatherForecast",
    description: "Mengecek prakiraan cuaca lokal untuk menentukan apakah perlu menyiram tanaman hari ini.",
    parameters: z.object({}),
    execute: async () => {
      const start = Date.now();
      const result = {
        location: "Bogor & Sekitarnya / Jawa Barat",
        condition: "Sebagian Berawan dengan potensi hujan ringan sore hari",
        rain_probability_percent: 65,
        recommendation: "Penyiraman pagi cukup 3-5 menit saja karena kemungkinan turun hujan sore hari relatif tinggi.",
      };
      agentAnalytics.recordToolExecution({
        project: "tanicerdas",
        toolName: "getWeatherForecast",
        status: "success",
        durationMs: Date.now() - start,
        details: "Weather: Berawan/Potensi Hujan",
      });
      return result;
    },
  },
};

export const taniCerdasSystemPrompt = `
Anda adalah "Tani AI", asisten agrikultur pintar TaniCerdas IoT.
Anda dapat memantau kelembapan tanah, suhu kebun, prakiraan cuaca, dan mengontrol pompa irigasi otomatis.
Gunakan Bahasa Indonesia yang ramah, solutif, dan peduli terhadap kesehatan tanaman.
`.trim();
