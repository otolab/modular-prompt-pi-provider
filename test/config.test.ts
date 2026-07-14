import { afterEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { homedir } from "node:os";
import { CONFIG_DIR_NAME, getAgentDir } from "@earendil-works/pi-coding-agent";
import {
  DEFAULT_MLX_MODEL,
  DEFAULT_MODEL_FALLBACK,
  createApplicationConfig,
  findModelSpec,
  modelHasCacheDir,
} from "../src/config.js";
import { modelSpecToPiProviderModel } from "../src/driver/model-catalog.js";
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

  it("defaults to gemma heretic 4bit model", () => {
    expect(DEFAULT_MLX_MODEL).toBe(DEFAULT_MODEL_FALLBACK);
  });

  it("registers default model in ApplicationConfig", () => {
    const config = createApplicationConfig();
    const spec = findModelSpec(config, DEFAULT_MLX_MODEL);
    expect(spec?.provider).toBe("mlx");
    expect(spec?.capabilities).toContain("streaming");
  });

  it("defaultOptions は MLX python 層に渡るフィールドのみ", () => {
    const config = createApplicationConfig();
    const spec = findModelSpec(config, DEFAULT_MLX_MODEL);
    expect(spec?.defaultOptions).toEqual({ maxTokens: 8_192 });
    expect(spec?.defaultOptions).not.toHaveProperty("mode");
  });

  it("maps ModelSpec to Pi provider model", () => {
    const config = createApplicationConfig();
    const spec = config.models![0]!;
    const piModel = modelSpecToPiProviderModel(spec);
    expect(piModel.id).toBe(DEFAULT_MLX_MODEL);
    expect(piModel.reasoning).toBe(true);
    expect(piModel.input).toEqual(["text"]);
  });

  it("MODULAR_PROMPT_PI_MODEL でデフォルトモデルを上書きする", () => {
    process.env.MODULAR_PROMPT_PI_MODEL = "mlx-community/custom-model";
    const config = createApplicationConfig();
    expect(config.models?.[0]?.model).toBe("mlx-community/custom-model");
  });

  it("YAML models を ApplicationConfig に反映する", () => {
    const globalPath = globalConfigPath();
    const yaml = loadPiProviderConfig({
      readFile: (path) => {
        if (path === globalPath) {
          return `
models:
  - model: mlx-community/yaml-model
    defaultOptions:
      maxTokens: 4096
drivers:
  mlx:
    pythonPath: /opt/python3
`;
        }
        throw new Error(`unexpected path: ${path}`);
      },
      fileExists: (path) => path === globalPath,
    });

    const config = createApplicationConfig(yaml);
    const spec = findModelSpec(config, "mlx-community/yaml-model");
    expect(spec?.defaultOptions).toEqual({ maxTokens: 4096 });
    expect(config.drivers?.mlx?.pythonPath).toBe("/opt/python3");
  });

  it("modelHasCacheDir は driverOptions.cacheDir の有無を判定する", () => {
    const withoutCache = createApplicationConfig();
    expect(modelHasCacheDir(withoutCache, DEFAULT_MLX_MODEL)).toBe(false);

    const withCache = createApplicationConfig({
      models: [
        {
          model: "mlx-community/cached",
          driverOptions: { cacheDir: "/tmp/cache" },
        },
      ],
    });
    expect(modelHasCacheDir(withCache, "mlx-community/cached")).toBe(true);
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
  - model: global/model
`,
    };

    const config = loadPiProviderConfig({
      cwd: "/project",
      isProjectTrusted: false,
      fileExists: (path) => path in files,
      readFile: (path) => files[path]!,
    });

    expect(config.models?.[0]?.model).toBe("global/model");
  });

  it("trust 前はプロジェクト config.yaml を読まない", () => {
    const globalPath = globalConfigPath();
    const projectPath = projectConfigPath("/project");
    const files: Record<string, string> = {
      [globalPath]: `
models:
  - model: global/model
`,
      [projectPath]: `
models:
  - model: project/model
`,
    };

    const config = loadPiProviderConfig({
      cwd: "/project",
      isProjectTrusted: false,
      fileExists: (path) => path in files,
      readFile: (path) => files[path]!,
    });

    expect(config.models?.[0]?.model).toBe("global/model");
  });

  it("trust 後はプロジェクト config.yaml で上書きする", () => {
    const globalPath = globalConfigPath();
    const projectPath = projectConfigPath("/project");
    const files: Record<string, string> = {
      [globalPath]: `
models:
  - model: global/model
    defaultOptions:
      maxTokens: 1000
drivers:
  mlx:
    pythonPath: /global/python
`,
      [projectPath]: `
models:
  - model: project/model
    defaultOptions:
      maxTokens: 2000
drivers:
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

    expect(config.models?.[0]?.model).toBe("project/model");
    expect(config.models?.[0]?.defaultOptions?.maxTokens).toBe(2000);
    expect(config.drivers?.mlx?.pythonPath).toContain("project/python");
    expect(config.models?.[0]?.driverOptions?.cacheDir).toBe(
      join("/project", CONFIG_DIR_NAME, PLUGIN_DIR_NAME, "cache"),
    );
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
  - model: m1
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
