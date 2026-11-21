import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { v1Router } from "./routes/v1.js";
import { adminRouter } from "./routes/admin.js";
import { db } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT) || 4000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Static frontend dashboard files
const publicDir = path.resolve(__dirname, "public");
app.use(express.static(publicDir));

// Healthcheck
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "AI Hub - Unified AI Gateway",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    stats: db.getStats(),
  });
});

// OpenAI-compatible v1 router (used by nexus-chat, resumecraft, python, curl, etc.)
app.use("/v1", v1Router);

// Admin management API
app.use("/api", adminRouter);

// Fallback: serve dashboard SPA
app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// Start Server
const server = app.listen(port, () => {
  console.log("==================================================================");
  console.log("🚀 [AI HUB] Central AI Gateway & Multi-Provider Router");
  console.log("==================================================================");
  console.log(`📡 Server Address       : http://localhost:${port}`);
  console.log(`🌐 OpenAI-Compatible API: http://localhost:${port}/v1`);
  console.log(`📊 Admin Dashboard      : http://localhost:${port}`);
  console.log(`🔑 Master Admin Token   : ${db.getSettings().adminToken}`);
  console.log("------------------------------------------------------------------");
  console.log("Active Default Project Keys:");
  for (const k of db.listApiKeys()) {
    console.log(`  • [${k.project.padEnd(12)}] ${k.key}`);
  }
  console.log("==================================================================");
});

server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n❌ [AI Hub] Port ${port} is already in use by another process.`);
    console.error(`💡 Set a different port using environment variable: PORT=${port + 1} pnpm start\n`);
  } else {
    console.error("[AI Hub Server Error]:", err);
  }
});

// Graceful Shutdown
const shutdown = (signal: string) => {
  console.log(`\n[AI Hub] Received ${signal}. Flushing database and shutting down cleanly...`);
  db.save();
  server.close(() => {
    console.log("[AI Hub] Gateway stopped gracefully. Goodbye!");
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
