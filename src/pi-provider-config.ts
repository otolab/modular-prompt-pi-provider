import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CONFIG_DIR_NAME, getAgentDir } from "@earendil-works/pi-coding-agent";
import { parse as parseYaml } from "yaml";

/** Pi プラグインのディレクトリ名（プロバイダ ID と一致） */
export const PLUGIN_DIR_NAME = "modular-prompt-provider";

/** プラグイン設定ファイル名（`modular-prompt-provider/config.yaml`） */
export const CONFIG_FILENAME = "config.yaml";

/** YAML `models[]` の 1 エントリ */
export interface PiProviderYamlModelEntry {
  model: string;
  provider?: string;
  capabilities?: string[];
  maxInputTokens?: number;
  maxOutputTokens?: number;
  priority?: number;
  driverOptions?: {
    cacheDir?: string;
    textOnly?: boolean;
    maxImageSize?: number;
    drafterModel?: string;
    draftBlockSize?: number;
  };
  defaultOptions?: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
  };
}

/** modular-prompt-provider/config.yaml の生データ */
export interface PiProviderYamlConfig {
  models?: PiProviderYamlModelEntry[];
  drivers?: {
    mlx?: {
      baseURL?: string;
      pythonPath?: string;
    };
  };
  cache?: {
    maxAgeDays?: number;
    maxSizeGb?: number;
    minFreeDiskGb?: number;
    sweepOnStartup?: boolean;
    sweepBeforeWrite?: boolean;
  };
  logging?: {
    level?: string;
    requestResponseLevel?: "none" | "minimal" | "full";
    dir?: string;
  };
}

export interface LoadPiProviderConfigOptions {
  cwd?: string;
  isProjectTrusted?: boolean;
  /** テスト用: ファイル存在判定 */
  fileExists?: (path: string) => boolean;
  /** テスト用: ファイル読み込み */
  readFile?: (path: string) => string;
}

export interface PiProviderConfigPaths {
  global: string;
  project: string;
}

/** `~/` をホームディレクトリに展開する */
export function expandPath(value: string, homeDir: string = homedir()): string {
  if (value === "~") {
    return homeDir;
  }
  if (value.startsWith("~/")) {
    return join(homeDir, value.slice(2));
  }
  return value;
}

function expandPathFields(
  config: PiProviderYamlConfig,
  homeDir: string,
): PiProviderYamlConfig {
  const expanded: PiProviderYamlConfig = {
    ...config,
    models: config.models?.map((entry) => ({
      ...entry,
      driverOptions: entry.driverOptions
        ? {
            ...entry.driverOptions,
            ...(entry.driverOptions.cacheDir
              ? { cacheDir: expandPath(entry.driverOptions.cacheDir, homeDir) }
              : {}),
          }
        : undefined,
    })),
    drivers: config.drivers
      ? {
          ...config.drivers,
          mlx: config.drivers.mlx
            ? {
                ...config.drivers.mlx,
                ...(config.drivers.mlx.pythonPath
                  ? { pythonPath: expandPath(config.drivers.mlx.pythonPath, homeDir) }
                  : {}),
                ...(config.drivers.mlx.baseURL
                  ? { baseURL: expandPath(config.drivers.mlx.baseURL, homeDir) }
                  : {}),
              }
            : undefined,
        }
      : undefined,
    logging: config.logging
      ? {
          ...config.logging,
          ...(config.logging.dir
            ? { dir: expandPath(config.logging.dir, homeDir) }
            : {}),
        }
      : undefined,
  };

  return expanded;
}

function mergeYamlConfig(
  base: PiProviderYamlConfig,
  override: PiProviderYamlConfig,
): PiProviderYamlConfig {
  return {
    ...base,
    ...override,
    models: override.models ?? base.models,
    drivers: {
      ...base.drivers,
      ...override.drivers,
      mlx: {
        ...base.drivers?.mlx,
        ...override.drivers?.mlx,
      },
    },
    cache: {
      ...base.cache,
      ...override.cache,
    },
    logging: {
      ...base.logging,
      ...override.logging,
    },
  };
}

function parseConfigFile(
  path: string,
  readFile: (path: string) => string,
): PiProviderYamlConfig | undefined {
  try {
    const parsed = parseYaml(readFile(path));
    if (parsed === null || parsed === undefined) {
      return {};
    }
    if (typeof parsed !== "object" || Array.isArray(parsed)) {
      console.error(`Invalid ${CONFIG_FILENAME} at ${path}: expected a mapping`);
      return undefined;
    }
    return parsed as PiProviderYamlConfig;
  } catch (error) {
    console.error(`Failed to load ${CONFIG_FILENAME} from ${path}: ${error}`);
    return undefined;
  }
}

export function resolvePiProviderConfigPaths(
  cwd: string = process.cwd(),
): PiProviderConfigPaths {
  return {
    global: join(getAgentDir(), PLUGIN_DIR_NAME, CONFIG_FILENAME),
    project: join(cwd, CONFIG_DIR_NAME, PLUGIN_DIR_NAME, CONFIG_FILENAME),
  };
}

export function resolvePluginDataDir(options: {
  cwd: string;
  isProjectTrusted: boolean;
  usedProjectConfig: boolean;
}): string {
  return options.usedProjectConfig && options.isProjectTrusted
    ? join(options.cwd, CONFIG_DIR_NAME, PLUGIN_DIR_NAME)
    : join(getAgentDir(), PLUGIN_DIR_NAME);
}

export function resolveDefaultCacheDir(options: {
  cwd: string;
  isProjectTrusted: boolean;
  usedProjectConfig: boolean;
}): string {
  return join(resolvePluginDataDir(options), "cache");
}

export function resolveDefaultLoggingDir(options: {
  cwd: string;
  isProjectTrusted: boolean;
  usedProjectConfig: boolean;
}): string {
  return join(resolvePluginDataDir(options), "logs", "requests");
}

/**
 * グローバル YAML を読み、trust 済みならプロジェクト YAML を上書きマージする。
 * `~/.modular-prompt-pi/` や `services.yaml` は読まない。
 */
export function loadPiProviderConfig(
  options: LoadPiProviderConfigOptions = {},
): PiProviderYamlConfig {
  const cwd = options.cwd ?? process.cwd();
  const isProjectTrusted = options.isProjectTrusted ?? false;
  const fileExists = options.fileExists ?? existsSync;
  const readFile = options.readFile ?? ((path) => readFileSync(path, "utf-8"));
  const paths = resolvePiProviderConfigPaths(cwd);

  let merged: PiProviderYamlConfig = {};
  let usedProjectConfig = false;

  if (fileExists(paths.global)) {
    const globalConfig = parseConfigFile(paths.global, readFile);
    if (globalConfig) {
      merged = mergeYamlConfig(merged, globalConfig);
    }
  }

  if (isProjectTrusted && fileExists(paths.project)) {
    const projectConfig = parseConfigFile(paths.project, readFile);
    if (projectConfig) {
      merged = mergeYamlConfig(merged, projectConfig);
      usedProjectConfig = true;
    }
  }

  const scope = { cwd, isProjectTrusted, usedProjectConfig };
  const withDefaultCacheDirs = applyDefaultCacheDirs(merged, scope);
  const withLogging = applyLoggingDefaults(withDefaultCacheDirs, scope);

  return expandPathFields(withLogging, homedir());
}

function applyLoggingDefaults(
  config: PiProviderYamlConfig,
  scope: { cwd: string; isProjectTrusted: boolean; usedProjectConfig: boolean },
): PiProviderYamlConfig {
  if (!config.logging) {
    return config;
  }

  const defaultDir = resolveDefaultLoggingDir(scope);
  return {
    ...config,
    logging: {
      level: config.logging.level ?? "info",
      requestResponseLevel: config.logging.requestResponseLevel ?? "minimal",
      dir: config.logging.dir ?? defaultDir,
    },
  };
}

function applyDefaultCacheDirs(
  config: PiProviderYamlConfig,
  scope: { cwd: string; isProjectTrusted: boolean; usedProjectConfig: boolean },
): PiProviderYamlConfig {
  if (!config.models?.length) {
    return config;
  }

  const defaultCacheDir = resolveDefaultCacheDir(scope);
  return {
    ...config,
    models: config.models.map((entry) => ({
      ...entry,
      driverOptions: {
        ...entry.driverOptions,
        cacheDir: entry.driverOptions?.cacheDir ?? defaultCacheDir,
      },
    })),
  };
}
