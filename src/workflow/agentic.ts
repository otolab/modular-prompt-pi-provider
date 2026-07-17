import type { ToolCall, ToolDefinition } from "@modular-prompt/driver";
import { agenticProcess, type DriverSet } from "@modular-prompt/process";
import type { WorkflowRequest, WorkflowResult } from "./types.js";
import { piAgenticModule } from "./pi-prompt-module.js";

function parseToolArguments(
  args: string | Record<string, unknown>,
): Record<string, unknown> {
  if (typeof args === "string") {
    return JSON.parse(args) as Record<string, unknown>;
  }
  return args;
}

function extractPendingToolCalls(
  executionLog: Array<{ pendingToolCalls?: ToolCall[] }> | undefined,
): ToolCall[] {
  return executionLog?.flatMap((entry) => entry.pendingToolCalls ?? []) ?? [];
}

/** agentic workflow — agenticProcess を Pi 向け WorkflowResult に変換 */
export async function runAgenticWorkflow(
  driverSet: DriverSet,
  request: WorkflowRequest,
): Promise<WorkflowResult> {
  const result = await agenticProcess(
    driverSet,
    piAgenticModule,
    { compiled: request.compiled },
    {
      tools: request.queryOptions.tools,
      enablePlanning: true,
      includeThinking: false,
    },
  );

  const executionLog = result.context.executionLog;
  const pendingToolCalls = extractPendingToolCalls(executionLog);

  if (pendingToolCalls.length > 0) {
    return {
      type: "tool_calls",
      calls: pendingToolCalls.map((toolCall) => ({
        id: toolCall.id,
        name: toolCall.name,
        arguments: parseToolArguments(toolCall.arguments),
      })),
      text: result.output || undefined,
      queryResult: {
        content: result.output || "",
        finishReason: "tool_calls",
        toolCalls: pendingToolCalls,
      },
    };
  }

  return {
    type: "response",
    text: result.output || "",
    queryResult: {
      content: result.output || "",
      finishReason: "stop",
    },
  };
}

export type { ToolDefinition };
