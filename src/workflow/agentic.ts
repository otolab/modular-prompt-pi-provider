import type { ToolDefinition } from "@modular-prompt/driver";
import { formatCompletionPrompt } from "@modular-prompt/driver";
import { agenticProcess, type DriverSet } from "@modular-prompt/process";
import type { WorkflowRequest, WorkflowResult } from "./types.js";
import { piAgenticModule } from "./pi-prompt-module.js";
import {
  buildExecutionLogForLog,
  countTaskTypes,
  extractPendingToolCalls,
  extractRegisteredTasks,
  type AgenticWorkflowLogger,
} from "./agentic-logging.js";

function parseToolArguments(
  args: string | Record<string, unknown>,
): Record<string, unknown> {
  if (typeof args === "string") {
    return JSON.parse(args) as Record<string, unknown>;
  }
  return args;
}

export interface RunAgenticWorkflowOptions {
  logger?: AgenticWorkflowLogger;
  modelName?: string;
}

/** agentic workflow — agenticProcess を Pi 向け WorkflowResult に変換 */
export async function runAgenticWorkflow(
  driverSet: DriverSet,
  request: WorkflowRequest,
  options?: RunAgenticWorkflowOptions,
): Promise<WorkflowResult> {
  const logger = options?.logger;
  const toolCount = request.queryOptions.tools?.length ?? 0;

  await logger?.logPrompt(formatCompletionPrompt(request.compiled), {
    toolCount,
  });

  let result;
  try {
    result = await agenticProcess(
      driverSet,
      piAgenticModule,
      { compiled: request.compiled },
      {
        tools: request.queryOptions.tools,
        enablePlanning: true,
        includeThinking: false,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logger?.logError(message, {
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }

  const executionLog = result.context.executionLog;
  const pendingToolCalls = extractPendingToolCalls(executionLog);
  const registeredTasks = extractRegisteredTasks(executionLog);

  if (registeredTasks.length > 0) {
    await logger?.logTaskRegistration?.(registeredTasks);
  }

  const executionLogForLog = buildExecutionLogForLog(executionLog);
  const taskTypeCounts = countTaskTypes(executionLog);
  const finishReason = pendingToolCalls.length > 0 ? "tool_calls" : "stop";
  const { context: _context, ...logData } = result;

  await logger?.logLlmResponse(
    {
      ...logData,
      finishReason,
      executionLog: executionLogForLog,
      taskTypeCounts,
    },
    options?.modelName,
  );

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
