import type { AIDriver } from "@modular-prompt/driver";
import type { ResolvedProviderConfig, VirtualModelSelection } from "../config/types.js";
import { resolvePassthroughLogicalName } from "../config/resolve-model-set.js";
import type { LogicalModelSelection } from "../config/types.js";
import { getAllCacheStats } from "../driver/cache-stats.js";
import { buildDriverSetFromModelSet } from "./driver-set.js";
import { runAgenticWorkflow, type RunAgenticWorkflowOptions } from "./agentic.js";
import {
  buildPassthroughRequest,
  streamPassthroughWorkflow,
} from "./passthrough.js";
import type { WorkflowRequest, WorkflowResult, WorkflowStreamHandle } from "./types.js";

export type RunVirtualAgenticOptions = RunAgenticWorkflowOptions;

function requireVirtualModelSet(
  selection: VirtualModelSelection,
): string {
  const modelSet = selection.workflow.modelSet;
  if (!modelSet) {
    throw new Error(
      `workflow.${selection.workflowKey} requires modelSet for virtualModel "${selection.virtualName}".`,
    );
  }
  return modelSet;
}

function toLogicalSelection(
  config: ResolvedProviderConfig,
  logicalName: string,
): LogicalModelSelection {
  const model = config.logicalModels.get(logicalName);
  if (!model || model.disabled) {
    throw new Error(`Logical model "${logicalName}" is not available.`);
  }
  return {
    kind: "logical",
    logicalName,
    model,
  };
}

/** virtualModel + passthrough workflow */
export async function runVirtualPassthroughStream(
  config: ResolvedProviderConfig,
  selection: VirtualModelSelection,
  driver: AIDriver,
  request: WorkflowRequest,
): Promise<WorkflowStreamHandle> {
  const modelSetName = requireVirtualModelSet(selection);
  const logicalName = resolvePassthroughLogicalName(config, modelSetName);

  return streamPassthroughWorkflow({
    driver,
    request,
    phase: `${selection.virtualName}:${logicalName}`,
  });
}

/** virtualModel + agentic workflow（非ストリーム。結果を一括返す） */
export async function runVirtualAgenticWorkflow(
  config: ResolvedProviderConfig,
  selection: VirtualModelSelection,
  request: WorkflowRequest,
  options?: RunVirtualAgenticOptions,
): Promise<WorkflowResult> {
  const modelSetName = requireVirtualModelSet(selection);
  const { driverSet } = await buildDriverSetFromModelSet(config, modelSetName);
  const result = await runAgenticWorkflow(driverSet, request, options);

  const allStats = getAllCacheStats(driverSet);
  if (Object.keys(allStats).length > 0) {
    await options?.logger?.logCacheStats?.(allStats);
  }

  return result;
}

export function resolveVirtualPassthroughLogicalName(
  config: ResolvedProviderConfig,
  selection: VirtualModelSelection,
): string {
  const modelSetName = requireVirtualModelSet(selection);
  return resolvePassthroughLogicalName(config, modelSetName);
}

export { toLogicalSelection };
