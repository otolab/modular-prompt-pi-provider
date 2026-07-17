import { describe, expect, it } from "vitest";
import { normalizeProviderConfig } from "../src/config/normalize-config.js";
import {
  resolveDefaultSelection,
  resolveProcessFallback,
  resolveSelection,
} from "../src/config/resolve-selection.js";

function baseConfig() {
  return normalizeProviderConfig({
    models: {
      gemma: {
        provider: "mlx",
        model: "mlx-community/gemma",
        defaultQueryOptions: { maxTokens: 8192 },
      },
      "gemma-old": {
        provider: "mlx",
        model: "mlx-community/gemma-old",
        defaultQueryOptions: { maxTokens: 8192 },
        disabled: true,
      },
    },
    workflow: {
      agentic: {
        type: "agentic",
        modelSet: "default",
        virtualModel: "agentic-chat",
      },
    },
    processes: {
      default: { model: "gemma" },
    },
  });
}

describe("resolveSelection", () => {
  it("論理名を解決する", () => {
    const config = baseConfig();
    const selection = resolveSelection("gemma", config);
    expect(selection?.kind).toBe("logical");
    if (selection?.kind === "logical") {
      expect(selection.logicalName).toBe("gemma");
    }
  });

  it("disabled モデルは解決しない", () => {
    const config = baseConfig();
    expect(resolveSelection("gemma-old", config)).toBeUndefined();
  });

  it("virtualModel を解決する", () => {
    const config = baseConfig();
    const selection = resolveSelection("agentic-chat", config);
    expect(selection?.kind).toBe("virtual");
    if (selection?.kind === "virtual") {
      expect(selection.workflowKey).toBe("agentic");
    }
  });
});

describe("resolveProcessFallback", () => {
  it("processes.default.model を解決する", () => {
    const config = baseConfig();
    const fallback = resolveProcessFallback(config);
    expect(fallback?.kind).toBe("logical");
    if (fallback?.kind === "logical") {
      expect(fallback.logicalName).toBe("gemma");
    }
  });
});

describe("resolveDefaultSelection", () => {
  it("defaultLogicalModel を返す", () => {
    const config = normalizeProviderConfig({
      models: {
        primary: {
          provider: "mlx",
          model: "mlx-community/primary",
          defaultQueryOptions: { maxTokens: 8192 },
        },
      },
    });
    const selection = resolveDefaultSelection(config);
    expect(selection?.kind).toBe("logical");
    if (selection?.kind === "logical") {
      expect(selection.logicalName).toBe("primary");
    }
  });
});
