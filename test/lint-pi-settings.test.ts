import { describe, expect, it, vi } from "vitest";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { normalizeProviderConfig } from "../src/config/normalize-config.js";
import {
  ValidationCollector,
  lintPiSettings,
  logConfigValidationWarnings,
} from "../src/config/validation/index.js";

describe("lintPiSettings", () => {
  it("物理パス形式の defaultModel を警告する", () => {
    const config = normalizeProviderConfig({
      models: {
        gemma: {
          provider: "mlx",
          model: "mlx-community/gemma",
          defaultQueryOptions: { maxTokens: 8192 },
        },
      },
    });

    const collector = new ValidationCollector();
    const settingsPath = join(getAgentDir(), "settings.json");

    lintPiSettings(collector, config, {
      fileExists: (path) => path === settingsPath,
      readFile: () =>
        JSON.stringify({
          defaultProvider: "modular-prompt-provider",
          defaultModel: "mlx-community/gemma-4bit",
        }),
    });

    const warnings = collector.getWarnings();
    expect(warnings.some((issue) => issue.path === "settings.json")).toBe(true);
    expect(warnings[0]?.message).toMatch(/physical model path/);
  });

  it("未登録論理名の defaultModel を警告する", () => {
    const config = normalizeProviderConfig({
      models: {
        gemma: {
          provider: "mlx",
          model: "mlx-community/gemma",
          defaultQueryOptions: { maxTokens: 8192 },
        },
      },
    });

    const collector = new ValidationCollector();
    const settingsPath = join(getAgentDir(), "settings.json");

    lintPiSettings(collector, config, {
      fileExists: (path) => path === settingsPath,
      readFile: () =>
        JSON.stringify({
          defaultProvider: "modular-prompt-provider",
          defaultModel: "unknown-logical",
        }),
    });

    expect(collector.getWarnings()[0]?.message).toMatch(/not registered/);
  });
});

describe("logConfigValidationWarnings", () => {
  it("警告を console.warn に出力する", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    logConfigValidationWarnings([
      { severity: "warning", path: "test.path", message: "test message" },
    ]);
    expect(warn).toHaveBeenCalledWith("[modular-prompt-provider] test.path: test message");
    warn.mockRestore();
  });
});
