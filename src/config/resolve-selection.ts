import type { ModelSelection, ResolvedProviderConfig } from "./types.js";

/** Pi が渡す model.id（論理名 or virtualModel）を解決する */
export function resolveSelection(
  modelId: string,
  config: ResolvedProviderConfig,
): ModelSelection | undefined {
  const virtual = config.virtualModels.get(modelId);
  if (virtual) {
    return {
      kind: "virtual",
      virtualName: virtual.name,
      workflowKey: virtual.workflowKey,
      workflow: virtual.workflow,
    };
  }

  const logical = config.logicalModels.get(modelId);
  if (logical && !logical.disabled) {
    return {
      kind: "logical",
      logicalName: logical.logicalName,
      model: logical,
    };
  }

  return undefined;
}

/** processes.default — model id 未決時のフォールバック */
export function resolveProcessFallback(
  config: ResolvedProviderConfig,
): ModelSelection | undefined {
  const fallbackModel = config.processes.default?.model;
  if (!fallbackModel) {
    return undefined;
  }
  return resolveSelection(fallbackModel, config);
}

/** modelId 未指定時に default 論理モデルを返す */
export function resolveDefaultSelection(
  config: ResolvedProviderConfig,
): ModelSelection | undefined {
  const defaultModel = config.logicalModels.get(config.defaultLogicalModel);
  if (!defaultModel || defaultModel.disabled) {
    return undefined;
  }

  return {
    kind: "logical",
    logicalName: defaultModel.logicalName,
    model: defaultModel,
  };
}
