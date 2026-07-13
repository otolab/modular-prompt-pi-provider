import type { AIDriver } from "@modular-prompt/driver";
import { findModelSpec } from "../config.js";
import { getAIService, getApplicationConfig } from "./service.js";

let activeModelId: string | undefined;
let activeDriver: AIDriver | undefined;

/**
 * モデル ID に対応する AIDriver を返す。
 * MLX はメモリ制約のため同時に 1 インスタンスのみ保持し、切替時は close する。
 */
export async function getDriverForModel(modelId: string): Promise<AIDriver> {
  const appConfig = getApplicationConfig();
  const spec = findModelSpec(appConfig, modelId);
  if (!spec) {
    throw new Error(
      `Unknown model "${modelId}". Register it in ApplicationConfig.models (see src/config.ts).`,
    );
  }

  if (activeModelId === modelId && activeDriver) {
    return activeDriver;
  }

  if (activeDriver) {
    await activeDriver.close();
    activeDriver = undefined;
    activeModelId = undefined;
  }

  const aiService = getAIService();
  activeDriver = await aiService.createDriver(spec);
  activeModelId = modelId;
  return activeDriver;
}

export async function closeActiveDriver(): Promise<void> {
  if (activeDriver) {
    await activeDriver.close();
    activeDriver = undefined;
    activeModelId = undefined;
  }
}
