import { afterEach, describe, expect, it, vi } from "vitest";
import { TestDriver } from "@modular-prompt/driver";
import {
  closeAllDrivers,
  getDriverForLogicalModel,
  resetModelRegistry,
} from "../src/driver/model-registry.js";
import { initResolvedProviderConfig, resetAIService } from "../src/driver/service.js";

vi.mock("@modular-prompt/driver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@modular-prompt/driver")>();
  return {
    ...actual,
    AIService: vi.fn().mockImplementation(() => ({
      createDriver: vi.fn(async () => new TestDriver({ responses: ["ok"] })),
    })),
  };
});

describe("model-registry", () => {
  afterEach(async () => {
    await closeAllDrivers();
    resetModelRegistry();
    resetAIService();
  });

  it("論理名ごとに driver を取得する", async () => {
    initResolvedProviderConfig({
      models: {
        gemma: {
          provider: "mlx",
          model: "mlx-community/gemma",
          defaultQueryOptions: { maxTokens: 8192 },
        },
      },
    });

    const driver = await getDriverForLogicalModel("gemma");
    expect(driver).toBeDefined();
    const again = await getDriverForLogicalModel("gemma");
    expect(again).toBe(driver);
  });

  it("未知の論理名はエラー", async () => {
    initResolvedProviderConfig();
    await expect(getDriverForLogicalModel("missing")).rejects.toThrow(/Unknown logical model/);
  });

  it("closeAllDrivers で全インスタンスを解放する", async () => {
    initResolvedProviderConfig({
      models: {
        gemma: {
          provider: "mlx",
          model: "mlx-community/gemma",
          defaultQueryOptions: { maxTokens: 8192 },
        },
      },
    });
    await getDriverForLogicalModel("gemma");
    await closeAllDrivers();
    const driver = await getDriverForLogicalModel("gemma");
    expect(driver).toBeDefined();
  });
});
