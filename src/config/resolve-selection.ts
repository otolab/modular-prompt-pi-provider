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

/** Pi stream 用の model 解決（未登録 id → processes.default） */
export function resolveStreamSelection(
  modelId: string,
  config: ResolvedProviderConfig,
): ModelSelection | undefined {
  const direct = resolveSelection(modelId, config);
  if (direct) {
    return direct;
  }

  return resolveProcessFallback(config);
}

export type StreamSelectionSource = "model.id" | "processes.default";

/** stream 解決とフォールバック経路 */
export function resolveStreamSelectionWithSource(
  modelId: string,
  config: ResolvedProviderConfig,
): { selection: ModelSelection; source: StreamSelectionSource } | undefined {
  const direct = resolveSelection(modelId, config);
  if (direct) {
    return { selection: direct, source: "model.id" };
  }

  const fallback = resolveProcessFallback(config);
  if (fallback) {
    return { selection: fallback, source: "processes.default" };
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

/** stream 時の model 解決失敗メッセージ（resolveStreamSelection が undefined のときのみ呼ぶ） */
export function formatStreamSelectionError(
  modelId: string,
  config: ResolvedProviderConfig,
): string {
  const fallbackModel = config.processes.default?.model;
  if (!fallbackModel) {
    return `Unknown model "${modelId}". Register it in config.yaml models.`;
  }

  return (
    `Unknown model "${modelId}" and processes.default.model "${fallbackModel}" ` +
    "is not a registered logical model or virtualModel."
  );
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
