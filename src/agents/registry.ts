import { cctvTools, cctvSystemPrompt } from "./tools/cctv.js";
import { flowmeterTools, flowmeterSystemPrompt } from "./tools/flowmeter.js";
import { taniCerdasTools, taniCerdasSystemPrompt } from "./tools/tanicerdas.js";
import { shopTools, shopSystemPrompt } from "./tools/shop.js";
import { pulseTools, pulseSystemPrompt } from "./tools/pulse.js";
import { memoryTools } from "./memory.js";
import type { ProjectScopeConfig, AgentTool } from "./types.js";

const superAdminPrompt = `
Anda adalah "Omni Master AI", asisten komando pusat untuk seluruh ekosistem proyek dan smart devices pengguna di AI Hub.
Anda memiliki akses ke seluruh sub-sistem:
1. EdgeSentinel CCTV: Monitor kamera, live frame snapshot, deteksi orang asing, foto vision, dan sirine darurat.
2. Universal Flow Meter ESP32: Monitor literan digital, auto-cutoff pengisian cairan/solar, dan emergency stop valve.
3. TaniCerdas Smart Farming: Sensor tanah, suhu, dan pompa irigasi otomatis.
4. Rusty Shop: Laporan omset toko dan cek stok produk.
5. Pulse Infrastructure: Kesehatan container Docker dan latensi VPS.
6. Long-Term Memory: Mengingat fakta permanen (nama keluarga, plat mobil, hewan peliharaan, preferensi).

Gunakan tool yang tepat sesuai instruksi pengguna dalam Bahasa Indonesia yang ramah, ringkas, dan profesional.
`.trim();

export const projectRegistry: Record<string, ProjectScopeConfig> = {
  cctv: {
    id: "cctv",
    name: "EdgeSentinel Security Assistant",
    description: "Asisten pemantauan CCTV, deteksi AI, live snapshot, vision foto, sirine darurat, dan arming mode.",
    systemPrompt: cctvSystemPrompt,
    tools: cctvTools,
    welcomeMessage: "Halo! Saya Sentinel AI siap membantu memantau keamanan rumah, mengambil foto live kamera, menganalisis orang asing, atau membunyikan alarm darurat jika dibutuhkan.",
    quickSuggestions: [
      { label: "📊 Status Sistem", prompt: "Bagaimana status hardware CCTV dan Raspberry Pi sekarang?" },
      { label: "📹 Cek Kamera", prompt: "Kamera mana saja yang saat ini aktif dan online?" },
      { label: "📸 Foto Live Gerbang", prompt: "Tolong ambil foto live dari Gerbang Depan sekarang!" },
      { label: "🚨 Ada Orang Asing?", prompt: "Apakah ada kejadian orang asing atau loitering mencurigakan hari ini?" },
      { label: "🔔 Bunyikan Sirine", prompt: "Tolong bunyikan sirine darurat selama 5 detik!" },
    ],
  },
  flowmeter: {
    id: "flowmeter",
    name: "Universal Flow Meter & Dispenser",
    description: "Asisten literan digital multifluida ESP32-S3: monitoring debit, auto cut-off solenoid valve, dan riwayat transaksi.",
    systemPrompt: flowmeterSystemPrompt,
    tools: flowmeterTools,
    welcomeMessage: "Halo! Saya Flow AI, asisten literan digital multifluida ESP32-S3. Siap memantau debit, memulai pengisian otomatis dengan auto cut-off, atau mengecek transaksi.",
    quickSuggestions: [
      { label: "⛽ Status Literan", prompt: "Bagaimana status literan flow meter saat ini? Berapa volume batch dan debitnya?" },
      { label: "🎯 Isi 10 Liter", prompt: "Tolong mulai pengisian dispenser otomatis dengan target 10 Liter." },
      { label: "💰 Isi Rp 50.000", prompt: "Tolong mulai pengisian dispenser dengan target Rp 50.000." },
      { label: "📜 Riwayat Transaksi", prompt: "Tampilkan riwayat transaksi pengisian terakhir yang tercatat di flow meter." },
      { label: "⏹ Emergency Stop", prompt: "Hentikan pengisian darurat sekarang dan tutup solenoid valve!" },
    ],
  },
  tanicerdas: {
    id: "tanicerdas",
    name: "TaniCerdas Smart Farming",
    description: "Asisten agrikultur pintar: sensor kelembapan tanah, cuaca, dan pompa irigasi otomatis.",
    systemPrompt: taniCerdasSystemPrompt,
    tools: taniCerdasTools,
    welcomeMessage: "Halo! Saya Tani AI. Saya siap memantau kelembapan tanah dan mengontrol pompa irigasi kebun Anda.",
    quickSuggestions: [
      { label: "🌱 Sensor Tanah", prompt: "Bagaimana kelembapan tanah dan suhu di kebun sayur?" },
      { label: "💧 Siram Kebun", prompt: "Tolong aktifkan pompa penyiraman di kebun sayur selama 5 menit." },
      { label: "⛅ Cek Cuaca", prompt: "Bagaimana prakiraan cuaca hari ini? Perlu disiram tidak?" },
    ],
  },
  shop: {
    id: "shop",
    name: "Rusty Shop Assistant",
    description: "Asisten operasional toko online: omset harian, cek sisa stok, dan monitoring barang.",
    systemPrompt: shopSystemPrompt,
    tools: shopTools,
    welcomeMessage: "Halo! Saya Niaga AI siap membantu mengecek laporan penjualan toko dan persediaan stok gudang.",
    quickSuggestions: [
      { label: "💰 Omset Hari Ini", prompt: "Berapa total penjualan dan pesanan toko hari ini?" },
      { label: "📦 Cek Stok Menipis", prompt: "Produk apa saja yang stoknya mulai menipis di gudang?" },
    ],
  },
  pulse: {
    id: "pulse",
    name: "Pulse Infrastructure Monitor",
    description: "Asisten DevOps: monitoring container Docker, uptime server, dan latensi jaringan.",
    systemPrompt: pulseSystemPrompt,
    tools: pulseTools,
    welcomeMessage: "Halo DevOps! Pulse AI siap memberikan laporan kesehatan server dan container Docker Anda.",
    quickSuggestions: [
      { label: "🐳 Status Container", prompt: "Apakah semua container Docker di VPS berjalan normal?" },
      { label: "⚡ Tes Latensi Ping", prompt: "Berapa latensi ping dan DNS ke server saat ini?" },
    ],
  },
  superadmin: {
    id: "superadmin",
    name: "Omni SuperAdmin Gateway",
    description: "Pusat komando terpadu lintas seluruh proyek (CCTV, Flow Meter, Tani, Toko, Server, dan Memori Jangka Panjang).",
    systemPrompt: superAdminPrompt,
    tools: {
      ...cctvTools,
      ...flowmeterTools,
      ...taniCerdasTools,
      ...shopTools,
      ...pulseTools,
      ...memoryTools,
    },
    welcomeMessage: "Halo Administrator! Omni Hub aktif. Anda memiliki kendali penuh atas semua perangkat, literan dispenser, memori permanen, dan sub-proyek.",
    quickSuggestions: [
      { label: "🌐 Ringkasan Semua Sistem", prompt: "Berikan ringkasan cepat status CCTV, literan flow meter, kebun TaniCerdas, dan server VPS!" },
      { label: "⛽ Status Flow Meter", prompt: "Cek kondisi flow meter dispenser dan total literan solar." },
      { label: "📸 Foto Live Kamera", prompt: "Ambil foto live dari Gerbang Depan sekarang." },
      { label: "🧠 Cek Memori Rumah", prompt: "Apa saja fakta atau aturan rumah yang kamu ingat?" },
    ],
  },
};

export function getProjectScope(scopeId: string): ProjectScopeConfig {
  const normalized = (scopeId || "cctv").toLowerCase().trim();
  if (projectRegistry[normalized]) {
    return projectRegistry[normalized];
  }
  return projectRegistry.cctv;
}

export function listAvailableProjects() {
  return Object.values(projectRegistry).map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    toolCount: Object.keys(p.tools).length,
    tools: Object.keys(p.tools),
    suggestions: p.quickSuggestions,
  }));
}

export function getAllTools(): Record<string, AgentTool> {
  return projectRegistry.superadmin.tools;
}
