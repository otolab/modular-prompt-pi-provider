import type { AIDriver } from "@modular-prompt/driver";
import { findModelSpec } from "../config.js";
import { getAIService, getApplicationConfig, getResolvedProviderConfig } from "./service.js";

const activeDrivers = new Map<string, AIDriver>();
const inflightCreations = new Map<string, Promise<AIDriver>>();

/**
 * 論理モデル名に対応する AIDriver を返す。
 * 論理モデルごとに 1 インスタンスを保持し、同時リクエストは inflight で dedup する。
 */
export async function getDriverForLogicalModel(logicalName: string): Promise<AIDriver> {
  const existing = activeDrivers.get(logicalName);
  if (existing) {
    return existing;
  }

  const inflight = inflightCreations.get(logicalName);
  if (inflight) {
    return inflight;
  }

  const creation = createDriverForLogicalModel(logicalName);
  inflightCreations.set(logicalName, creation);

  try {
    const driver = await creation;
    activeDrivers.set(logicalName, driver);
    return driver;
  } finally {
    inflightCreations.delete(logicalName);
  }
}

async function createDriverForLogicalModel(logicalName: string): Promise<AIDriver> {
  const resolved = getResolvedProviderConfig();
  const spec = findModelSpec(resolved, logicalName);
  if (!spec) {
    throw new Error(
      `Unknown logical model "${logicalName}". Register it in config.yaml models (see docs/configuration.md).`,
    );
  }

  const aiService = getAIService(getApplicationConfig());
  return aiService.createDriver(spec);
}

/** 保持中の全ドライバを close する */
export async function closeAllDrivers(): Promise<void> {
  const closers = [...activeDrivers.values()].map((driver) => driver.close());
  activeDrivers.clear();
  inflightCreations.clear();
  await Promise.all(closers);
}

/** @deprecated {@link closeAllDrivers} を使用 */
export async function closeActiveDriver(): Promise<void> {
  await closeAllDrivers();
}

/** テスト用: レジストリをリセット */
export function resetModelRegistry(): void {
  activeDrivers.clear();
  inflightCreations.clear();
}
