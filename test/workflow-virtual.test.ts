import { describe, expect, it, vi, beforeEach } from "vitest";
import { TestDriver } from "@modular-prompt/driver";
import { normalizeProviderConfig } from "../src/config/normalize-config.js";
import {
  resolveModelSetLogicalName,
  resolvePassthroughLogicalName,
} from "../src/config/resolve-model-set.js";
import { buildDriverSetFromModelSet } from "../src/workflow/driver-set.js";
import { getDriverForLogicalModel } from "../src/driver/pool.js";

vi.mock("../src/driver/pool.js", () => ({
  getDriverForLogicalModel: vi.fn(),
  getDriverForModel: vi.fn(),
  closeAllDrivers: vi.fn(),
  closeActiveDriver: vi.fn(),
}));

function sampleConfig() {
  return normalizeProviderConfig({
    models: {
      default: {
        provider: "mlx",
        model: "mlx-community/default",
        defaultQueryOptions: { maxTokens: 8192 },
      },
      chat: {
        provider: "mlx",
        model: "mlx-community/chat",
        defaultQueryOptions: { maxTokens: 8192 },
      },
    },
    modelSets: {
      default: { default: "default", chat: "chat" },
    },
  });
}

describe("resolve-model-set", () => {
  it("modelSet の役割から論理名を解決する", () => {
    const config = sampleConfig();
    expect(resolveModelSetLogicalName(config, "default", "chat")).toBe("chat");
    expect(resolvePassthroughLogicalName(config, "default")).toBe("chat");
  });
});

describe("buildDriverSetFromModelSet", () => {
  beforeEach(() => {
    vi.mocked(getDriverForLogicalModel).mockImplementation(async (logicalName) => {
      return new TestDriver({ responses: [`driver:${logicalName}`] });
    });
  });

  it("modelSet から DriverSet を構築する", async () => {
    const config = sampleConfig();
    const { driverSet, primaryLogicalName } = await buildDriverSetFromModelSet(
      config,
      "default",
    );

    expect(primaryLogicalName).toBe("chat");
    expect(driverSet.default).toBeDefined();
    expect(driverSet.chat).toBeDefined();
    expect(getDriverForLogicalModel).toHaveBeenCalledWith("default");
    expect(getDriverForLogicalModel).toHaveBeenCalledWith("chat");
  });
});
