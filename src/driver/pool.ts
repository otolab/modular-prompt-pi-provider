import type { AIDriver } from "@modular-prompt/driver";
import {
  closeAllDrivers as closeAllDriversInRegistry,
  closeActiveDriver as closeActiveDriverInRegistry,
  getDriverForLogicalModel,
} from "./model-registry.js";

/**
 * モデル ID（論理名）に対応する AIDriver を返す。
 * @deprecated 内部は {@link getDriverForLogicalModel} に委譲
 */
export async function getDriverForModel(modelId: string): Promise<AIDriver> {
  return getDriverForLogicalModel(modelId);
}

export async function closeAllDrivers(): Promise<void> {
  await closeAllDriversInRegistry();
}

/** @deprecated {@link closeAllDrivers} を使用 */
export async function closeActiveDriver(): Promise<void> {
  await closeActiveDriverInRegistry();
}

export { getDriverForLogicalModel } from "./model-registry.js";
