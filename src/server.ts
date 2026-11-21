import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { v1Router } from "./routes/v1.js";
import { adminRouter } from "./routes/admin.js";
import { agentsRouter } from "./routes/agents.js";
import { mcpRouter } from "./routes/mcp.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { cronEngine } from "./agents/services/cron.js";
import { db } from "./db.js";
import { sendWebhookAlert } from "./services/webhook.js";

// Listen for budget alerts and forward to configured webhooks
db.on("budgetAlert", ({ key, threshold, pct }) => {
  const isExceeded = threshold >= 100;
  const severity = isExceeded ? "error" : "warning";
  const title = isExceeded ? "🚨 Kuota Token Habis!" : "⚠️ Peringatan Kuota Token 80%";
  const msg = isExceeded
    ? `API Key "${key.name}" (${key.project}) telah mencapai ${pct}% dari limit bulanan (${key.currentMonthTokens?.toLocaleString()} / ${key.maxMonthlyTokens?.toLocaleString()} tokens). Request berikutnya dapat ditolak.`
    : `API Key "${key.name}" (${key.project}) telah menggunakan ${pct}% dari kuota bulanan (${key.currentMonthTokens?.toLocaleString()} / ${key.maxMonthlyTokens?.toLocaleString()} tokens).`;
  sendWebhookAlert(title, msg, severity).catch(err => {
    console.warn("[AI Hub] Budget webhook alert error:", err.message);
  });
});

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
app.use(express.static(publicDir, { index: false }));

let cachedDashboardHtml: string | null = null;

function renderDashboardHtml(): string {
  if (process.env.NODE_ENV === "production" && cachedDashboardHtml) {
    return cachedDashboardHtml;
  }

  const templatePath = path.join(publicDir, "index.html");
  if (!fs.existsSync(templatePath)) return "AI Hub Dashboard template not found";

  let html = fs.readFileSync(templatePath, "utf-8");
  html = html.replace(/<!--#include\s+file=["'](.+?)["']\s*-->/g, (_match, relPath) => {
    const compPath = path.join(publicDir, relPath);
    if (fs.existsSync(compPath)) {
      return fs.readFileSync(compPath, "utf-8");
    }
    return `<!-- Component ${relPath} not found -->`;
  });

  if (process.env.NODE_ENV === "production") {
    cachedDashboardHtml = html;
  }

  return html;
}

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

app.get("/health/providers", (_req, res) => {
  const providers = db.getProviders();
  const summary: Record<string, any> = {};
  for (const [id, cfg] of Object.entries(providers)) {
    summary[id] = {
      name: cfg.name,
      isEnabled: cfg.isEnabled,
      isAvailable: cfg.isAvailable,
      modelsCount: cfg.models.length,
      hasKey: Boolean(cfg.apiKey && cfg.apiKey.length > 5) || id === "ollama",
    };
  }
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    providers: summary,
  });
});

// OpenAI-compatible v1 router (used by nexus-chat, resumecraft, python, curl, etc.)
app.use("/v1", v1Router);

// Autonomous Agents & Tool Orchestration API
app.use("/api/agents", agentsRouter);

// Backward-compatible endpoints for embedded widgets
app.post("/api/chat", (req, res, next) => {
  req.url = "/chat";
  agentsRouter(req, res, next);
});
app.get("/api/projects", (req, res, next) => {
  req.url = "/projects";
  agentsRouter(req, res, next);
});
app.get("/api/projects/:id", (req, res, next) => {
  req.url = `/projects/${req.params.id}`;
  agentsRouter(req, res, next);
});

// Standard Model Context Protocol (MCP) JSON-RPC endpoints
app.use("/api/mcp", mcpRouter);
app.use("/mcp", mcpRouter);

// Inbound Messaging & IoT Webhooks (WhatsApp, Telegram, EdgeSentinel CCTV)
app.use("/api/webhooks", webhooksRouter);

// Admin management API
app.use("/api", adminRouter);

// Fallback: serve modular dashboard SPA
app.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(renderDashboardHtml());
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/v1") || req.path.includes(".")) {
    return next();
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(renderDashboardHtml());
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

  // Start autonomous background cron patrol engine
  cronEngine.start();
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
  cronEngine.stop();
  db.save();
  server.close(() => {
    console.log("[AI Hub] Gateway stopped gracefully. Goodbye!");
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
