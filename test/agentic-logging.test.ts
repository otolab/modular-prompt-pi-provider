import { describe, expect, it } from "vitest";
import type { AgenticTaskExecutionLog } from "@modular-prompt/process";
import {
  buildExecutionLogForLog,
  countTaskTypes,
  extractPendingToolCalls,
  extractRegisteredTasks,
} from "../src/workflow/agentic-logging.js";

describe("agentic-logging", () => {
  const executionLog: AgenticTaskExecutionLog[] = [
    {
      taskType: "planning",
      taskName: "plan",
      instruction: "plan tasks",
      result: "",
      toolCallLog: [
        {
          name: "think",
          arguments: {
            name: "analyze",
            instruction: "read the request",
            reason: "needed",
            driverRole: "chat",
          },
          result: null,
        },
        {
          name: "__register_task",
          arguments: {
            name: "legacy",
            taskType: "act",
            instruction: "do work",
          },
          result: null,
        },
      ],
    },
    {
      taskType: "think",
      taskName: "analyze",
      instruction: "read the request",
      result: "done",
      pendingToolCalls: [{ id: "tc1", name: "search", arguments: {} }],
    },
  ];

  it("planning フェーズから登録タスクを抽出する", () => {
    expect(extractRegisteredTasks(executionLog)).toEqual([
      {
        name: "analyze",
        taskType: "think",
        instruction: "read the request",
        reason: "needed",
        driverRole: "chat",
      },
      {
        name: "legacy",
        taskType: "act",
        instruction: "do work",
        reason: undefined,
        driverRole: undefined,
      },
    ]);
  });

  it("pendingToolCalls を平坦化する", () => {
    expect(extractPendingToolCalls(executionLog)).toEqual([
      { id: "tc1", name: "search", arguments: {} },
    ]);
  });

  it("executionLog をログ用に整形する", () => {
    expect(buildExecutionLogForLog(executionLog)).toEqual([
      {
        taskName: "plan",
        taskType: "planning",
        instruction: "plan tasks",
        result: "",
        toolCallLog: executionLog[0]!.toolCallLog,
        pendingToolCalls: undefined,
      },
      {
        taskName: "analyze",
        taskType: "think",
        instruction: "read the request",
        result: "done",
        toolCallLog: undefined,
        pendingToolCalls: [{ id: "tc1", name: "search" }],
      },
    ]);
  });

  it("タスクタイプを集計する", () => {
    expect(countTaskTypes(executionLog)).toEqual({
      planning: 1,
      think: 1,
    });
  });
});
