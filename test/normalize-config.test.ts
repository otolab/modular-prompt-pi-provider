import { describe, expect, it } from "vitest";
import {
  logicalModelToSpec,
  normalizeProviderConfig,
  normalizeProviders,
  resolveLogicalModels,
} from "../src/config/normalize-config.js";
import { DEFAULT_MODEL_FALLBACK } from "../src/constants.js";

describe("normalizeProviderConfig", () => {
  it("YAML 未指定時は models.default を DEFAULT_MODEL_FALLBACK で生成する", () => {
    const resolved = normalizeProviderConfig();
    expect(resolved.defaultLogicalModel).toBe("default");
    const logical = resolved.logicalModels.get("default");
    expect(logical?.physicalModel).toBe(DEFAULT_MODEL_FALLBACK);
    expect(logical?.defaultQueryOptions).toEqual({ maxTokens: 8_192 });
  });

  it("legacy drivers を providers.mlx にマージする", () => {
    const providers = normalizeProviders({
      drivers: { mlx: { pythonPath: "/legacy/python" } },
      providers: { mlx: { baseURL: "/providers/url" } },
    });
    expect(providers.mlx).toEqual({
      pythonPath: "/legacy/python",
      baseURL: "/providers/url",
    });
  });

  it("models マップを論理名で解決する", () => {
    const logicalModels = resolveLogicalModels({
      models: {
        gemma: {
          provider: "mlx_lm",
          model: "mlx-community/gemma",
          defaultQueryOptions: { maxTokens: 4096, temperature: 0.5 },
        },
      },
    });
    const gemma = logicalModels.get("gemma");
    expect(gemma?.provider).toBe("mlx");
    expect(gemma?.physicalModel).toBe("mlx-community/gemma");
    expect(gemma?.defaultQueryOptions).toEqual({ maxTokens: 4096, temperature: 0.5 });
  });

  it("defaultQueryOptions 未指定はエラー", () => {
    expect(() =>
      logicalModelToSpec("bad", {
        provider: "mlx",
        model: "mlx-community/x",
        defaultQueryOptions: {},
      }),
    ).toThrow(/requires defaultQueryOptions/);
  });

  it("disabled モデルは applicationConfig.models から除外する", () => {
    const resolved = normalizeProviderConfig({
      models: {
        active: {
          provider: "mlx",
          model: "mlx-community/active",
          defaultQueryOptions: { maxTokens: 8192 },
        },
        retired: {
          provider: "mlx",
          model: "mlx-community/retired",
          defaultQueryOptions: { maxTokens: 8192 },
          disabled: true,
        },
      },
    });
    expect(resolved.applicationConfig.models?.map((s) => s.model)).toEqual([
      "mlx-community/active",
    ]);
  });

  it("providers.cacheDir を model の driverOptions に注入する", () => {
    const resolved = normalizeProviderConfig({
      providers: {
        mlx: { cacheDir: "/tmp/provider-cache" },
      },
      models: {
        gemma: {
          provider: "mlx",
          model: "mlx-community/gemma",
          defaultQueryOptions: { maxTokens: 8192 },
        },
      },
    });
    expect(resolved.logicalModels.get("gemma")?.spec.driverOptions?.cacheDir).toBe(
      "/tmp/provider-cache",
    );
  });

  it("model 個別の driverOptions.cacheDir は無視する", () => {
    const resolved = normalizeProviderConfig({
      providers: {
        mlx: { cacheDir: "/tmp/provider-cache" },
      },
      models: {
        gemma: {
          provider: "mlx",
          model: "mlx-community/gemma",
          defaultQueryOptions: { maxTokens: 8192 },
          driverOptions: { cacheDir: "/tmp/model-cache" },
        },
      },
    });
    expect(resolved.logicalModels.get("gemma")?.spec.driverOptions?.cacheDir).toBe(
      "/tmp/provider-cache",
    );
  });

  it("virtualModel を workflow から抽出する", () => {
    const resolved = normalizeProviderConfig({
      models: {
        gemma: {
          provider: "mlx",
          model: "mlx-community/gemma",
          defaultQueryOptions: { maxTokens: 8192 },
        },
      },
      workflow: {
        agentic: {
          type: "agentic",
          modelSet: "default",
          virtualModel: "agentic-chat",
        },
      },
    });
    expect(resolved.virtualModels.get("agentic-chat")?.workflowKey).toBe("agentic");
  });
});
