import type { DriverSet } from "@modular-prompt/process";
import type { ResolvedProviderConfig } from "../config/types.js";
import { DRIVER_ROLES, resolveModelSetLogicalName } from "../config/resolve-model-set.js";
import { getDriverForLogicalModel } from "../driver/pool.js";

export function resolveDriverSetRoleNames(
  config: ResolvedProviderConfig,
  modelSetName: string,
): { primaryLogicalName: string; roleLogicalNames: Record<string, string> } {
  const defaultLogical = resolveModelSetLogicalName(config, modelSetName, "default");
  const roleLogicalNames: Record<string, string> = { default: defaultLogical };

  for (const role of DRIVER_ROLES) {
    const modelSet = config.modelSets[modelSetName];
    if (modelSet?.[role]) {
      roleLogicalNames[role] = resolveModelSetLogicalName(config, modelSetName, role);
    }
  }

  const modelSet = config.modelSets[modelSetName]!;
  return {
    primaryLogicalName: modelSet.chat ?? defaultLogical,
    roleLogicalNames,
  };
}

/** modelSet から DriverSet を構築する（agentic workflow 用） */
export async function buildDriverSetFromModelSet(
  config: ResolvedProviderConfig,
  modelSetName: string,
): Promise<{
  driverSet: DriverSet;
  primaryLogicalName: string;
  roleLogicalNames: Record<string, string>;
}> {
  const { primaryLogicalName, roleLogicalNames } = resolveDriverSetRoleNames(
    config,
    modelSetName,
  );
  const driverSet: DriverSet = {
    default: await getDriverForLogicalModel(roleLogicalNames.default!),
  };

  for (const role of DRIVER_ROLES) {
    const logicalName = roleLogicalNames[role];
    if (logicalName) {
      driverSet[role] = await getDriverForLogicalModel(logicalName);
    }
  }

  return { driverSet, primaryLogicalName, roleLogicalNames };
}
