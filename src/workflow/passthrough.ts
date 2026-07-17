import type { QueryResult } from "@modular-prompt/driver";
import type {
  PassthroughWorkflowContext,
  WorkflowRequest,
  WorkflowResult,
  WorkflowStreamHandle,
} from "./types.js";

function toWorkflowResult(queryResult: QueryResult): WorkflowResult {
  if (queryResult.toolCalls && queryResult.toolCalls.length > 0) {
    return {
      type: "tool_calls",
      calls: queryResult.toolCalls,
      text: queryResult.content || undefined,
      queryResult,
    };
  }

  return {
    type: "response",
    text: queryResult.content || "",
    queryResult,
  };
}

/** passthrough workflow — CompiledPrompt を driver に素通しする */
export async function streamPassthroughWorkflow(
  context: PassthroughWorkflowContext,
): Promise<WorkflowStreamHandle> {
  const { driver, request } = context;
  const { stream, result } = await driver.streamQuery(
    request.compiled,
    request.queryOptions,
  );
  return { stream, result };
}

/** 非ストリーム版（将来の process 経路向け） */
export async function runPassthroughWorkflow(
  context: PassthroughWorkflowContext,
): Promise<WorkflowResult> {
  const { driver, request } = context;
  const queryResult = await driver.query(request.compiled, request.queryOptions);
  return toWorkflowResult(queryResult);
}

export function buildPassthroughRequest(
  compiled: WorkflowRequest["compiled"],
  queryOptions: WorkflowRequest["queryOptions"],
): WorkflowRequest {
  return { compiled, queryOptions };
}
