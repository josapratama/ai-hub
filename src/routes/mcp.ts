import { Router, type Request, type Response } from "express";
import { getProjectScope } from "../agents/registry.js";
import { zodToJsonSchema } from "zod-to-json-schema";

export const mcpRouter = Router();

/**
 * Standard Model Context Protocol (MCP) JSON-RPC 2.0 handler
 * Endpoint: POST /api/mcp/:project?
 */
mcpRouter.post("/:project?", async (req: Request, res: Response): Promise<void> => {
  const projectId = req.params.project || "superadmin";
  const scope = getProjectScope(projectId);
  const { jsonrpc, id, method, params } = req.body || {};

  if (jsonrpc !== "2.0") {
    res.status(400).json({
      jsonrpc: "2.0",
      id,
      error: { code: -32600, message: "Invalid Request: expected jsonrpc 2.0" },
    });
    return;
  }

  try {
    switch (method) {
      case "initialize": {
        res.json({
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: `ai-hub-mcp (${scope.name})`,
              version: "1.0.0",
            },
          },
        });
        return;
      }

      case "tools/list": {
        const toolsList = Object.entries(scope.tools).map(([toolName, t]) => {
          let schema: any = {};
          if (t.parameters) {
            try {
              schema = zodToJsonSchema(t.parameters as any);
            } catch {}
          }
          return {
            name: toolName,
            description: t.description || "",
            inputSchema: schema,
          };
        });

        res.json({
          jsonrpc: "2.0",
          id,
          result: {
            tools: toolsList,
          },
        });
        return;
      }

      case "tools/call": {
        const { name, arguments: toolArgs } = params || {};
        const targetTool = scope.tools[name];

        if (!targetTool) {
          res.status(404).json({
            jsonrpc: "2.0",
            id,
            error: {
              code: -32601,
              message: `Tool "${name}" tidak ditemukan pada scope "${scope.id}"`,
            },
          });
          return;
        }

        const result = await targetTool.execute(toolArgs || {});
        res.json({
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
              },
            ],
          },
        });
        return;
      }

      default: {
        res.status(404).json({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32601,
            message: `Method "${method}" tidak didukung oleh AI Hub MCP Server`,
          },
        });
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      jsonrpc: "2.0",
      id,
      error: {
        code: -32603,
        message: errorMsg,
      },
    });
  }
});
