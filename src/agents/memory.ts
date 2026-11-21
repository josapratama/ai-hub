import fs from "fs";
import path from "path";
import { z } from "zod";
import { agentAnalytics } from "./analytics.js";
import type { AgentTool } from "./types.js";

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), "data");
const MEMORY_FILE = path.join(DATA_DIR, "memory.json");

export interface MemoryFact {
  id: string;
  timestamp: string;
  category: "security" | "family" | "vehicle" | "device" | "general";
  fact: string;
  tags: string[];
}

class MemoryStore {
  private facts: MemoryFact[] = [];

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(MEMORY_FILE)) {
        const raw = fs.readFileSync(MEMORY_FILE, "utf-8");
        this.facts = JSON.parse(raw);
      } else {
        // Default initial seed memories
        this.facts = [
          {
            id: "mem_seed_1",
            timestamp: new Date().toISOString(),
            category: "vehicle",
            fact: "Mobil Honda Brio putih plat B 1945 XYZ adalah kendaraan resmi pemilik rumah, jangan laporkan sebagai penyusup.",
            tags: ["mobil", "plat", "keluarga", "brio"],
          },
          {
            id: "mem_seed_2",
            timestamp: new Date().toISOString(),
            category: "family",
            fact: "Anjing peliharaan rumah bernama Milo, ras golden retriever warna coklat terang, sering bermain di area garasi.",
            tags: ["hewan", "anjing", "milo"],
          },
        ];
        this.save();
      }
    } catch (e) {
      console.warn("[MemoryStore] Failed to load memories:", e);
    }
  }

  private save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tempPath = `${MEMORY_FILE}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.facts, null, 2), "utf-8");
      fs.renameSync(tempPath, MEMORY_FILE);
    } catch (e) {
      console.error("[MemoryStore] Failed to save memories:", e);
    }
  }

  addFact(fact: string, category: MemoryFact["category"] = "general", tags: string[] = []): MemoryFact {
    const newEntry: MemoryFact = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      category,
      fact,
      tags: tags.map(t => t.toLowerCase()),
    };
    this.facts.unshift(newEntry);
    this.save();
    return newEntry;
  }

  search(query?: string, category?: string): MemoryFact[] {
    let result = this.facts;
    if (category) {
      result = result.filter(f => f.category === category);
    }
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(f =>
        f.fact.toLowerCase().includes(q) || f.tags.some(t => t.includes(q))
      );
    }
    return result;
  }

  remove(id: string): boolean {
    const idx = this.facts.findIndex(f => f.id === id);
    if (idx !== -1) {
      this.facts.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  getAll(): MemoryFact[] {
    return [...this.facts];
  }

  getPromptContext(): string {
    if (this.facts.length === 0) return "";
    const list = this.facts.map(f => `- [${f.category.toUpperCase()}] ${f.fact}`).join("\n");
    return `\n\n[MEMORI JANGKA PANJANG & KNOWLEDGE BASE PEMILIK]:\n${list}\n(Gunakan pengetahuan ini untuk mengenali orang/kendaraan/aturan rumah secara personal).`;
  }
}

export const memoryStore = new MemoryStore();

export const memoryTools: Record<string, AgentTool> = {
  rememberFact: {
    name: "rememberFact",
    description: "Menyimpan fakta penting baru ke memori permanen AI (misal: plat nomor anggota keluarga, hewan peliharaan, nama tetangga, atau preferensi pemilik).",
    parameters: z.object({
      fact: z.string().describe("Kalimat fakta yang ingin diingat"),
      category: z.enum(["security", "family", "vehicle", "device", "general"]).default("general").describe("Kategori fakta"),
      tags: z.array(z.string()).default([]).describe("Kata kunci tag untuk mempermudah pencarian"),
    }),
    execute: async ({ fact, category, tags }: any) => {
      const start = Date.now();
      const saved = memoryStore.addFact(fact, category, tags);
      agentAnalytics.recordToolExecution({
        project: "superadmin",
        toolName: "rememberFact",
        status: "success",
        durationMs: Date.now() - start,
        details: `Saved: ${fact.substring(0, 40)}...`,
      });
      return {
        status: "remembered",
        id: saved.id,
        fact: saved.fact,
        message: "Fakta ini telah tersimpan di memori permanen AI Hub.",
      };
    },
  },

  recallMemories: {
    name: "recallMemories",
    description: "Mencari dan membaca fakta-fakta yang pernah diajarkan atau diingat dari memori jangka panjang.",
    parameters: z.object({
      query: z.string().optional().describe("Kata kunci pencarian memori (misal: 'plat', 'anjing', 'keluarga')"),
      category: z.enum(["security", "family", "vehicle", "device", "general"]).optional().describe("Filter kategori"),
    }),
    execute: async ({ query, category }: any) => {
      const start = Date.now();
      const results = memoryStore.search(query, category);
      agentAnalytics.recordToolExecution({
        project: "superadmin",
        toolName: "recallMemories",
        status: "success",
        durationMs: Date.now() - start,
        details: `Found ${results.length} memories`,
      });
      return results;
    },
  },
};
