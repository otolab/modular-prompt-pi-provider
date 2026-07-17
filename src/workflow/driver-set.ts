import type { DriverSet } from "@modular-prompt/process";
import type { ResolvedProviderConfig } from "../config/types.js";
import { DRIVER_ROLES, resolveModelSetLogicalName } from "../config/resolve-model-set.js";
import { getDriverForLogicalModel } from "../driver/pool.js";

/** modelSet から DriverSet を構築する（agentic workflow 用） */
export async function buildDriverSetFromModelSet(
  config: ResolvedProviderConfig,
  modelSetName: string,
): Promise<{ driverSet: DriverSet; primaryLogicalName: string }> {
  const defaultLogical = resolveModelSetLogicalName(config, modelSetName, "default");
  const driverSet: DriverSet = {
    default: await getDriverForLogicalModel(defaultLogical),
  };

  for (const role of DRIVER_ROLES) {
    const modelSet = config.modelSets[modelSetName];
    const logicalName = modelSet?.[role];
    if (logicalName) {
      driverSet[role] = await getDriverForLogicalModel(
        resolveModelSetLogicalName(config, modelSetName, role),
      );
    }
  }

  const modelSet = config.modelSets[modelSetName]!;
  const primaryLogicalName = modelSet.chat ?? defaultLogical;

  return { driverSet, primaryLogicalName };
}
