import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { CONFIG_DIR_NAME, getAgentDir } from "@earendil-works/pi-coding-agent";
import {
  ConfigLoadError,
  ConfigValidationError,
  loadResolvedProviderConfig,
} from "../src/config.js";
import {
  CONFIG_FILENAME,
  PLUGIN_DIR_NAME,
  loadPiProviderConfig,
} from "../src/pi-provider-config.js";

function globalConfigPath(): string {
  return join(getAgentDir(), PLUGIN_DIR_NAME, CONFIG_FILENAME);
}

function projectConfigPath(cwd: string): string {
  return join(cwd, CONFIG_DIR_NAME, PLUGIN_DIR_NAME, CONFIG_FILENAME);
}

const validModel = `
models:
  gemma:
    provider: mlx
    model: mlx-community/gemma
    defaultQueryOptions:
      maxTokens: 8192
`;

describe("loadResolvedProviderConfig", () => {
  it("グローバル + プロジェクト merge 後に検証する", () => {
    const globalPath = globalConfigPath();
    const projectPath = projectConfigPath("/project");
    const files: Record<string, string> = {
      [globalPath]: validModel,
      [projectPath]: `
models:
  gemma:
    defaultQueryOptions:
      maxTokens: 0
`,
    };

    expect(() =>
      loadResolvedProviderConfig({
        cwd: "/project",
        isProjectTrusted: true,
        fileExists: (path) => path in files,
        readFile: (path) => files[path]!,
      }),
    ).toThrow(ConfigValidationError);
  });

  it("複数の検証エラーを一括で返す", () => {
    expect(() =>
      loadResolvedProviderConfig({
        cwd: "/project",
        isProjectTrusted: false,
        fileExists: () => false,
        readFile: () => "",
      }),
    ).not.toThrow();

    expect(() =>
      loadResolvedProviderConfig({
        cwd: "/project",
        isProjectTrusted: false,
        fileExists: (path) => path === globalConfigPath(),
        readFile: () => `
models:
  bad:
    provider: unknown-vendor
    model: ""
    defaultQueryOptions:
      maxTokens: -1
processes:
  default:
    model: missing
workflow:
  agentic:
    type: agentic
`,
      }),
    ).toThrow(/Invalid configuration:/);
  });
});

describe("loadPiProviderConfig fail-fast", () => {
  it("YAML パース失敗時は ConfigLoadError を throw する", () => {
    const globalPath = globalConfigPath();
    expect(() =>
      loadPiProviderConfig({
        fileExists: (path) => path === globalPath,
        readFile: () => "models: [",
      }),
    ).toThrow(ConfigLoadError);
  });

  it("ルートが配列の YAML は ConfigLoadError", () => {
    const globalPath = globalConfigPath();
    expect(() =>
      loadPiProviderConfig({
        fileExists: (path) => path === globalPath,
        readFile: () => "- item\n",
      }),
    ).toThrow(/expected a mapping/);
  });
});
