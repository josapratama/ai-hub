import { Router, type Request, type Response } from "express";
import { executeAgentChat } from "../agents/executor.js";
import { listAvailableProjects, getProjectScope, getAllTools } from "../agents/registry.js";
import { memoryStore } from "../agents/memory.js";
import { agentAnalytics } from "../agents/analytics.js";
import { cronEngine } from "../agents/services/cron.js";
import { processInboundWhatsAppMessage } from "../agents/services/whatsapp.js";
import { processTelegramInteraction } from "../agents/services/telegram.js";
import { agentConfig } from "../agents/config.js";

export const agentsRouter = Router();

/**
 * GET /api/agents/projects
 * List all available project scopes and their tools
 */
agentsRouter.get("/projects", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    projects: listAvailableProjects(),
  });
});

/**
 * GET /api/agents/projects/:id
 * Get details for a specific project scope
 */
agentsRouter.get("/projects/:id", (req: Request, res: Response) => {
  const scope = getProjectScope(req.params.id);
  res.json({
    id: scope.id,
    name: scope.name,
    description: scope.description,
    welcomeMessage: scope.welcomeMessage,
    tools: Object.keys(scope.tools),
    suggestions: scope.quickSuggestions,
  });
});

/**
 * POST /api/agents/chat
 * Multi-tenant agent chat endpoint
 */
agentsRouter.post("/chat", async (req: Request, res: Response): Promise<void> => {
  try {
    const { project = "cctv", messages = [], model, stream = false } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Array "messages" diperlukan dan tidak boleh kosong.' });
      return;
    }

    if (stream) {
      // Stream SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const result = await executeAgentChat({
        project,
        messages,
        modelPreference: model,
      });

      // Send tool calls event if any
      if (result.toolCalls && result.toolCalls.length > 0) {
        res.write(`data: ${JSON.stringify({ type: "tools", toolCalls: result.toolCalls })}\n\n`);
      }

      // Send text chunks
      res.write(`data: ${JSON.stringify({ type: "text", content: result.content })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "done", finishReason: result.finishReason })}\n\n`);
      res.end();
    } else {
      const result = await executeAgentChat({
        project,
        messages,
        modelPreference: model,
      });

      res.json({
        ...result,
        text: result.content,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Agent Chat Error]:", msg);
    if (!res.headersSent) {
      res.status(500).json({ error: msg });
    }
  }
});

/**
 * POST /api/agents/tools/:name/execute
 * Direct tool execution test
 */
agentsRouter.post("/tools/:name/execute", async (req: Request, res: Response): Promise<void> => {
  const { name } = req.params;
  const allTools = getAllTools();
  const tool = allTools[name];

  if (!tool) {
    res.status(404).json({ error: `Tool "${name}" tidak ditemukan.` });
    return;
  }

  try {
    const args = req.body || {};
    const result = await tool.execute(args);
    res.json({
      status: "ok",
      tool: name,
      args,
      result,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

/**
 * Memory Management Endpoints
 */
agentsRouter.get("/memory", (_req: Request, res: Response): void => {
  res.json({
    status: "ok",
    memories: memoryStore.getAll(),
  });
});

agentsRouter.post("/memory", (req: Request, res: Response): void => {
  try {
    const { fact, category = "general", tags = [] } = req.body || {};
    if (!fact) {
      res.status(400).json({ error: "Fakta tidak boleh kosong." });
      return;
    }
    const created = memoryStore.addFact(fact, category, tags);
    res.json({ status: "ok", memory: created });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

agentsRouter.delete("/memory/:id", (req: Request, res: Response): void => {
  const success = memoryStore.remove(req.params.id);
  res.json({ status: "ok", deleted: success });
});

/**
 * Autonomous Cron Jobs Endpoints
 */
agentsRouter.get("/cron/jobs", (_req: Request, res: Response): void => {
  res.json({
    status: "ok",
    jobs: cronEngine.getJobs(),
  });
});

agentsRouter.post("/cron/trigger/:jobId", async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await cronEngine.triggerJob(req.params.jobId);
    res.json({ status: "ok", jobId: req.params.jobId, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

/**
 * Analytics Summary Endpoint
 */
agentsRouter.get("/analytics", (_req: Request, res: Response): void => {
  res.json({
    status: "ok",
    data: agentAnalytics.getSummary(),
  });
});

/**
 * WhatsApp Simulation Endpoint
 */
agentsRouter.post("/whatsapp/simulate", async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, from = agentConfig.waNotifyPhone } = req.body || {};
    if (!message) {
      res.status(400).json({ error: "Pesan simulasi tidak boleh kosong." });
      return;
    }

    const reply = await processInboundWhatsAppMessage(from, message);
    res.json({
      status: "ok",
      from,
      userMessage: message,
      botReply: reply,
      targetWABridgeUrl: agentConfig.waBridgeUrl,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

/**
 * Telegram Simulation Endpoint
 */
agentsRouter.post("/telegram/simulate", async (req: Request, res: Response): Promise<void> => {
  try {
    const interaction = await processTelegramInteraction(req.body);
    res.json({ status: "ok", ...interaction });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});
