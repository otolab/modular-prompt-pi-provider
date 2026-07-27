import { afterEach, beforeEach, vi } from "vitest";
import type { TestDriver } from "@modular-prompt/driver";
import { createResolvedProviderConfig } from "../../../src/config.js";
import { closeActiveDriver, getDriverForLogicalModel } from "../../../src/driver/pool.js";
import { getResolvedProviderConfig } from "../../../src/driver/service.js";

export const TEST_LOGICAL_MODEL = "test-model";

export function buildTestDriverResolvedConfig() {
  return createResolvedProviderConfig({
    models: {
      [TEST_LOGICAL_MODEL]: {
        provider: "mlx",
        model: "mlx-community/test-model",
        defaultQueryOptions: { maxTokens: 8192 },
      },
    },
  });
}

/** TestDriver + pool mock を各テスト前後で差し替える */
export function installTestDriverHarness(getDriver: () => TestDriver): void {
  beforeEach(() => {
    vi.mocked(getResolvedProviderConfig).mockReturnValue(buildTestDriverResolvedConfig());
    vi.mocked(getDriverForLogicalModel).mockImplementation(async () => getDriver());
  });

  afterEach(async () => {
    await closeActiveDriver();
  });
}
