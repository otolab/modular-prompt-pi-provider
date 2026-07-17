import { afterEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { homedir } from "node:os";
import { CONFIG_DIR_NAME, getAgentDir } from "@earendil-works/pi-coding-agent";
import {
  DEFAULT_MLX_MODEL,
  DEFAULT_MODEL_FALLBACK,
  createApplicationConfig,
  createResolvedProviderConfig,
  findModelSpec,
  modelHasCacheDir,
  normalizeProviderConfig,
} from "../src/config.js";
import { buildPiProviderModels, modelSpecToPiProviderModel } from "../src/driver/model-catalog.js";
import { resetAIService } from "../src/driver/service.js";
import {
  CONFIG_FILENAME,
  PLUGIN_DIR_NAME,
  expandPath,
  loadPiProviderConfig,
  resolveDefaultCacheDir,
  resolveConfiguredRequestLogDir,
} from "../src/pi-provider-config.js";

function globalConfigPath(): string {
  return join(getAgentDir(), PLUGIN_DIR_NAME, CONFIG_FILENAME);
}

function projectConfigPath(cwd: string): string {
  return join(cwd, CONFIG_DIR_NAME, PLUGIN_DIR_NAME, CONFIG_FILENAME);
}

describe("config", () => {
  afterEach(() => {
    delete process.env.MODULAR_PROMPT_PI_MODEL;
    resetAIService();
  });

  it("defaults to gemma heretic 4bit model under logical name default", () => {
    expect(DEFAULT_MLX_MODEL).toBe(DEFAULT_MODEL_FALLBACK);
    const resolved = createResolvedProviderConfig();
    expect(resolved.defaultLogicalModel).toBe("default");
    const spec = findModelSpec(resolved, "default");
    expect(spec?.model).toBe(DEFAULT_MODEL_FALLBACK);
    expect(spec?.provider).toBe("mlx");
    expect(spec?.capabilities).toContain("streaming");
  });

  it("defaultQueryOptions は MLX python 層に渡るフィールドのみ", () => {
    const resolved = createResolvedProviderConfig();
    const spec = findModelSpec(resolved, "default");
    expect(spec?.defaultOptions).toEqual({ maxTokens: 8_192 });
    expect(spec?.defaultOptions).not.toHaveProperty("mode");
  });

  it("maps ModelSpec to Pi provider model by logical name", () => {
    const resolved = createResolvedProviderConfig();
    const logical = resolved.logicalModels.get("default")!;
    const piModel = modelSpecToPiProviderModel("default", logical.spec);
    expect(piModel.id).toBe("default");
    expect(piModel.name).toBe("default");
    expect(piModel.reasoning).toBe(true);
    expect(piModel.input).toEqual(["text"]);
  });

  it("MODULAR_PROMPT_PI_MODEL でデフォルト物理モデルを上書きする", () => {
    process.env.MODULAR_PROMPT_PI_MODEL = "mlx-community/custom-model";
    const resolved = createResolvedProviderConfig();
    expect(findModelSpec(resolved, "default")?.model).toBe("mlx-community/custom-model");
  });

  it("YAML models マップを ApplicationConfig に反映する", () => {
    const yaml = {
      models: {
        gemma: {
          provider: "mlx",
          model: "mlx-community/yaml-model",
          defaultQueryOptions: { maxTokens: 4096 },
        },
      },
      providers: {
        mlx: { pythonPath: "/opt/python3" },
      },
    };

    const config = createApplicationConfig(yaml);
    const resolved = createResolvedProviderConfig(yaml);
    const spec = findModelSpec(resolved, "gemma");
    expect(spec?.defaultOptions).toEqual({ maxTokens: 4096 });
    expect(config.drivers?.mlx?.pythonPath).toBe("/opt/python3");
  });

  it("レガシー YAML models[] を論理名 id ?? model で解決する", () => {
    const yaml = {
      models: [
        {
          id: "my-gemma",
          model: "mlx-community/yaml-model",
          defaultOptions: { maxTokens: 2048 },
        },
      ],
    };
    const resolved = createResolvedProviderConfig(yaml);
    expect(findModelSpec(resolved, "my-gemma")?.model).toBe("mlx-community/yaml-model");
  });

  it("buildPiProviderModels は論理名 + virtualModel を返す", () => {
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
    const piModels = buildPiProviderModels(resolved);
    expect(piModels.map((m) => m.id)).toEqual(["gemma", "agentic-chat"]);
  });

  it("modelHasCacheDir は driverOptions.cacheDir の有無を判定する", () => {
    const withoutCache = createResolvedProviderConfig();
    expect(modelHasCacheDir(withoutCache, "default")).toBe(false);

    const withCache = createResolvedProviderConfig({
      providers: {
        mlx: { cacheDir: "/tmp/cache" },
      },
      models: {
        cached: {
          provider: "mlx",
          model: "mlx-community/cached",
          defaultQueryOptions: { maxTokens: 8192 },
        },
      },
    });
    expect(modelHasCacheDir(withCache, "cached")).toBe(true);
  });
});

describe("pi-provider-config", () => {
  it("expandPath は ~/ を展開する", () => {
    expect(expandPath("~/cache", "/home/test")).toBe("/home/test/cache");
    expect(expandPath("~", "/home/test")).toBe("/home/test");
    expect(expandPath("/absolute/path", "/home/test")).toBe("/absolute/path");
  });

  it("グローバル config.yaml を読み込む", () => {
    const globalPath = globalConfigPath();
    const files: Record<string, string> = {
      [globalPath]: `
models:
  gemma:
    provider: mlx
    model: global/model
    defaultQueryOptions:
      maxTokens: 8192
`,
    };

    const config = loadPiProviderConfig({
      cwd: "/project",
      isProjectTrusted: false,
      fileExists: (path) => path in files,
      readFile: (path) => files[path]!,
    });

    const models = config.models as Record<string, { model: string }>;
    expect(models.gemma?.model).toBe("global/model");
  });

  it("trust 前はプロジェクト config.yaml を読まない", () => {
    const globalPath = globalConfigPath();
    const projectPath = projectConfigPath("/project");
    const files: Record<string, string> = {
      [globalPath]: `
models:
  global:
    provider: mlx
    model: global/model
    defaultQueryOptions:
      maxTokens: 8192
`,
      [projectPath]: `
models:
  project:
    provider: mlx
    model: project/model
    defaultQueryOptions:
      maxTokens: 8192
`,
    };

    const config = loadPiProviderConfig({
      cwd: "/project",
      isProjectTrusted: false,
      fileExists: (path) => path in files,
      readFile: (path) => files[path]!,
    });

    const models = config.models as Record<string, { model: string }>;
    expect(models.global?.model).toBe("global/model");
    expect(models.project).toBeUndefined();
  });

  it("trust 後はプロジェクト config.yaml で上書きする", () => {
    const globalPath = globalConfigPath();
    const projectPath = projectConfigPath("/project");
    const files: Record<string, string> = {
      [globalPath]: `
models:
  gemma:
    provider: mlx
    model: global/model
    defaultQueryOptions:
      maxTokens: 1000
providers:
  mlx:
    pythonPath: /global/python
`,
      [projectPath]: `
models:
  gemma:
    provider: mlx
    model: project/model
    defaultQueryOptions:
      maxTokens: 2000
providers:
  mlx:
    pythonPath: ~/project/python
`,
    };

    const config = loadPiProviderConfig({
      cwd: "/project",
      isProjectTrusted: true,
      fileExists: (path) => path in files,
      readFile: (path) => files[path]!,
    });

    const models = config.models as Record<
      string,
      { model: string; defaultQueryOptions?: { maxTokens?: number } }
    >;
    expect(models.gemma?.model).toBe("project/model");
    expect(models.gemma?.defaultQueryOptions?.maxTokens).toBe(2000);
    expect(config.providers?.mlx?.pythonPath).toContain("project/python");
    expect(config.providers?.mlx?.cacheDir).toBe(
      join("/project", CONFIG_DIR_NAME, PLUGIN_DIR_NAME, "cache"),
    );
  });


  it("models マップは論理名ごとに shallow merge する", () => {
    const globalPath = globalConfigPath();
    const projectPath = projectConfigPath("/project");
    const files: Record<string, string> = {
      [globalPath]: `
models:
  gemma:
    provider: mlx
    model: global/model
    defaultQueryOptions:
      maxTokens: 1000
      temperature: 0.1
  other:
    provider: mlx
    model: global/other
    defaultQueryOptions:
      maxTokens: 500
`,
      [projectPath]: `
models:
  gemma:
    defaultQueryOptions:
      maxTokens: 2000
`,
    };

    const config = loadPiProviderConfig({
      cwd: "/project",
      isProjectTrusted: true,
      fileExists: (path) => path in files,
      readFile: (path) => files[path]!,
    });

    const models = config.models as Record<
      string,
      { model: string; defaultQueryOptions?: { maxTokens?: number; temperature?: number } }
    >;
    expect(models.gemma?.model).toBe("global/model");
    expect(models.gemma?.defaultQueryOptions?.maxTokens).toBe(2000);
    expect(models.gemma?.defaultQueryOptions?.temperature).toBe(0.1);
    expect(models.other?.model).toBe("global/other");
  });

  it("resolveDefaultCacheDir はスコープに応じたパスを返す", () => {
    expect(
      resolveDefaultCacheDir({
        cwd: "/project",
        isProjectTrusted: true,
        usedProjectConfig: true,
      }),
    ).toBe(join("/project", CONFIG_DIR_NAME, PLUGIN_DIR_NAME, "cache"));
  });

  it("resolveConfiguredRequestLogDir は logging.dir を読む", () => {
    const globalPath = globalConfigPath();
    const files: Record<string, string> = {
      [globalPath]: `
logging:
  requestResponseLevel: full
  dir: ~/custom/request-logs
`,
    };

    expect(
      resolveConfiguredRequestLogDir({
        cwd: "/project",
        fileExists: (path) => path in files,
        readFile: (path) => files[path]!,
      }),
    ).toBe(join(homedir(), "custom/request-logs"));
  });

  it("resolveConfiguredRequestLogDir は logging 未設定時グローバルデフォルト", () => {
    const globalPath = globalConfigPath();
    const files: Record<string, string> = {
      [globalPath]: `
models:
  default:
    provider: mlx
    model: m1
    defaultQueryOptions:
      maxTokens: 8192
`,
    };

    expect(
      resolveConfiguredRequestLogDir({
        cwd: "/project",
        isProjectTrusted: false,
        fileExists: (path) => path in files,
        readFile: (path) => files[path]!,
      }),
    ).toBe(join(getAgentDir(), PLUGIN_DIR_NAME, "logs", "requests"));
  });
});
