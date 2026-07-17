import { describe, expect, it } from "vitest";
import { normalizeProviderConfig } from "../src/config/normalize-config.js";
import {
  formatStreamSelectionError,
  resolveDefaultSelection,
  resolveProcessFallback,
  resolveSelection,
  resolveStreamSelection,
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
    modelSets: {
      default: { chat: "gemma", default: "gemma" },
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

describe("resolveStreamSelection", () => {
  it("未登録 model.id は processes.default にフォールバックする", () => {
    const config = baseConfig();
    const selection = resolveStreamSelection("unknown-model", config);
    expect(selection?.kind).toBe("logical");
    if (selection?.kind === "logical") {
      expect(selection.logicalName).toBe("gemma");
    }
  });

  it("登録済み model.id は直接解決する", () => {
    const config = baseConfig();
    const selection = resolveStreamSelection("gemma", config);
    expect(selection?.kind).toBe("logical");
    if (selection?.kind === "logical") {
      expect(selection.logicalName).toBe("gemma");
    }
  });
});

describe("formatStreamSelectionError", () => {
  it("processes.default 未設定時は models 登録を促す", () => {
    const config = normalizeProviderConfig({
      models: {
        gemma: {
          provider: "mlx",
          model: "mlx-community/gemma",
          defaultQueryOptions: { maxTokens: 8192 },
        },
      },
    });
    expect(formatStreamSelectionError("unknown", config)).toContain(
      'Unknown model "unknown"',
    );
    expect(formatStreamSelectionError("unknown", config)).toContain("config.yaml models");
  });

  it("processes.default が未登録のとき両方を示す", () => {
    const config = normalizeProviderConfig({
      models: {
        gemma: {
          provider: "mlx",
          model: "mlx-community/gemma",
          defaultQueryOptions: { maxTokens: 8192 },
        },
      },
      processes: {
        default: { model: "gemma" },
      },
    });
    config.processes.default = { model: "also-missing" };
    expect(formatStreamSelectionError("unknown", config)).toContain("also-missing");
    expect(formatStreamSelectionError("unknown", config)).toContain("not a registered");
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
