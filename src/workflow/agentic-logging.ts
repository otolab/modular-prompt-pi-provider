import type { AgenticTaskExecutionLog } from "@modular-prompt/process";
import type { ToolCall } from "@modular-prompt/driver";

export interface RegisteredTaskInfo {
  name: string;
  taskType: string;
  instruction: string;
  reason?: string;
  driverRole?: string;
}

const KNOWN_TASK_TYPES = [
  "think",
  "act",
  "verify",
  "extractContext",
  "recall",
  "determine",
  "output",
] as const;

function parseToolArguments(
  args: string | Record<string, unknown>,
): Record<string, unknown> {
  if (typeof args === "string") {
    return JSON.parse(args) as Record<string, unknown>;
  }
  return args;
}

/** planning フェーズの toolCallLog から登録タスクを抽出する */
export function extractRegisteredTasks(
  executionLog: AgenticTaskExecutionLog[] | undefined,
): RegisteredTaskInfo[] {
  if (!executionLog) return [];

  return executionLog
    .filter((entry) => entry.taskType === "planning")
    .flatMap((entry) => entry.toolCallLog ?? [])
    .filter(
      (toolCall) =>
        toolCall.name === "__register_task" ||
        KNOWN_TASK_TYPES.includes(
          toolCall.name as (typeof KNOWN_TASK_TYPES)[number],
        ),
    )
    .map((toolCall) => {
      const args = parseToolArguments(toolCall.arguments);
      if (toolCall.name === "__register_task") {
        return {
          name: String(args.name ?? ""),
          taskType: String(args.taskType ?? ""),
          instruction: String(args.instruction ?? ""),
          reason: args.reason != null ? String(args.reason) : undefined,
          driverRole:
            args.driverRole != null ? String(args.driverRole) : undefined,
        };
      }
      return {
        name: String(args.name ?? ""),
        taskType: toolCall.name,
        instruction: String(args.instruction ?? ""),
        reason: args.reason != null ? String(args.reason) : undefined,
        driverRole:
          args.driverRole != null ? String(args.driverRole) : undefined,
      };
    });
}

export function extractPendingToolCalls(
  executionLog: AgenticTaskExecutionLog[] | undefined,
): ToolCall[] {
  return executionLog?.flatMap((entry) => entry.pendingToolCalls ?? []) ?? [];
}

/** llm_response 用に executionLog をサイズ抑制して整形する */
export function buildExecutionLogForLog(
  executionLog: AgenticTaskExecutionLog[] | undefined,
) {
  return executionLog?.map((entry) => ({
    taskName: entry.taskName,
    taskType: entry.taskType,
    instruction: entry.instruction,
    result: entry.result,
    toolCallLog: entry.toolCallLog,
    pendingToolCalls: entry.pendingToolCalls?.map((toolCall) => ({
      id: toolCall.id,
      name: toolCall.name,
    })),
  }));
}

export function countTaskTypes(
  executionLog: AgenticTaskExecutionLog[] | undefined,
): Record<string, number> {
  const counts: Record<string, number> = {};
  if (!executionLog) return counts;

  for (const entry of executionLog) {
    counts[entry.taskType] = (counts[entry.taskType] ?? 0) + 1;
  }
  return counts;
}

export interface AgenticWorkflowLogger {
  logPrompt(
    compiled: string,
    metadata?: { toolCount?: number },
  ): Promise<void> | void;
  logTaskRegistration?(tasks: RegisteredTaskInfo[]): Promise<void> | void;
  logLlmResponse(data: unknown, model?: string): Promise<void> | void;
  logError(message: string, data?: unknown): Promise<void> | void;
  logCacheStats?(stats: unknown): Promise<void> | void;
}
