import type { ModelRole } from "@modular-prompt/process";
import type { ResolvedProviderConfig } from "./types.js";

const DRIVER_ROLES: Exclude<ModelRole, "default">[] = [
  "chat",
  "plan",
  "thinking",
  "instruct",
];

/** modelSet の役割名 → models 論理名を解決する */
export function resolveModelSetLogicalName(
  config: ResolvedProviderConfig,
  modelSetName: string,
  role = "default",
): string {
  const modelSet = config.modelSets[modelSetName];
  if (!modelSet) {
    throw new Error(`modelSet "${modelSetName}" is not defined.`);
  }

  const logicalName = modelSet[role] ?? modelSet.default;
  if (!logicalName) {
    throw new Error(
      `modelSet "${modelSetName}" has no role "${role}" or "default".`,
    );
  }

  const logical = config.logicalModels.get(logicalName);
  if (!logical || logical.disabled) {
    throw new Error(
      `modelSet "${modelSetName}.${role}" references unknown or disabled model "${logicalName}".`,
    );
  }

  return logicalName;
}

/** passthrough virtualModel 用の代表論理名（chat → default の順） */
export function resolvePassthroughLogicalName(
  config: ResolvedProviderConfig,
  modelSetName: string,
): string {
  const modelSet = config.modelSets[modelSetName];
  if (!modelSet) {
    throw new Error(`modelSet "${modelSetName}" is not defined.`);
  }

  if (modelSet.chat) {
    return resolveModelSetLogicalName(config, modelSetName, "chat");
  }
  return resolveModelSetLogicalName(config, modelSetName, "default");
}

export { DRIVER_ROLES };
