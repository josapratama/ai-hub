import type { z } from "zod";

export interface AgentTool {
  name: string;
  description: string;
  parameters: z.ZodType<any>;
  execute: (args: any) => Promise<any>;
}

export interface QuickSuggestion {
  label: string;
  prompt: string;
}

export interface ProjectScopeConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  tools: Record<string, AgentTool>;
  welcomeMessage: string;
  quickSuggestions: QuickSuggestion[];
}

export interface ToolCallExecution {
  toolCallId: string;
  toolName: string;
  args: any;
  result?: any;
}

export interface AgentChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface AgentExecutionResult {
  role: "assistant";
  content: string;
  toolCalls: ToolCallExecution[];
  toolResults: Array<{ toolCallId: string; toolName: string; result: any }>;
  finishReason: string;
  modelUsed?: string;
  providerUsed?: string;
  durationMs?: number;
}
