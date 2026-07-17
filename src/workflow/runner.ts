import type { AIDriver } from "@modular-prompt/driver";
import type { LogicalModelSelection } from "../config/types.js";
import {
  buildPassthroughRequest,
  streamPassthroughWorkflow,
} from "./passthrough.js";
import type { WorkflowRequest, WorkflowStreamHandle } from "./types.js";

/** 論理モデル選択に対する暗黙 passthrough workflow（Phase 2） */
export async function runLogicalPassthroughStream(
  selection: LogicalModelSelection,
  driver: AIDriver,
  request: WorkflowRequest,
): Promise<WorkflowStreamHandle> {
  return streamPassthroughWorkflow({
    driver,
    request,
    phase: selection.logicalName,
  });
}

export { buildPassthroughRequest };
