import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CONFIG_DIR_NAME, getAgentDir } from "@earendil-works/pi-coding-agent";
import { parse as parseYaml } from "yaml";

/** Pi プラグインのディレクトリ名（プロバイダ ID と一致） */
export const PLUGIN_DIR_NAME = "modular-prompt-provider";

/** プラグイン設定ファイル名（`modular-prompt-provider/config.yaml`） */
export const CONFIG_FILENAME = "config.yaml";

/** YAML `models[]` の 1 エントリ（レガシー配列形式） */
export interface PiProviderYamlModelEntry {
  id?: string;
  model: string;
  provider?: string;
  disabled?: boolean;
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
  defaultQueryOptions?: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
  };
}

/** modular-prompt-provider/config.yaml の生データ */
export interface PiProviderYamlConfig {
  /** 新形式: 論理名 → 定義。レガシー: 配列 */
  models?:
    | PiProviderYamlModelEntry[]
    | Record<
        string,
        {
          provider: string;
          model: string;
          defaultQueryOptions: PiProviderYamlModelEntry["defaultQueryOptions"];
          disabled?: boolean;
          capabilities?: string[];
          maxInputTokens?: number;
          maxOutputTokens?: number;
          priority?: number;
          driverOptions?: PiProviderYamlModelEntry["driverOptions"];
        }
      >;
  /** @deprecated {@link providers} を使用 */
  drivers?: {
    mlx?: {
      baseURL?: string;
      pythonPath?: string;
      cacheDir?: string;
    };
  };
  providers?: {
    mlx?: {
      baseURL?: string;
      pythonPath?: string;
      cacheDir?: string;
    };
    mlx_lm?: {
      baseURL?: string;
      pythonPath?: string;
      cacheDir?: string;
    };
    [key: string]:
      | {
          baseURL?: string;
          pythonPath?: string;
          cacheDir?: string;
        }
      | undefined;
  };
  modelSets?: Record<string, Record<string, string>>;
  workflow?: Record<
    string,
    {
      type: "passthrough" | "agentic";
      modelSet?: string;
      virtualModel?: string;
    }
  >;
  processes?: Record<string, { model: string }>;
  compact?: {
    strategy?: string;
    targetTokens?: number;
    tokenLimit?: number;
    maxChunk?: number;
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

function expandProviderPaths(
  providers: PiProviderYamlConfig["providers"],
  homeDir: string,
): PiProviderYamlConfig["providers"] {
  if (!providers) {
    return undefined;
  }

  const expanded: NonNullable<PiProviderYamlConfig["providers"]> = {};
  for (const [name, provider] of Object.entries(providers)) {
    if (!provider) {
      continue;
    }
    expanded[name] = {
      ...provider,
      ...(provider.pythonPath
        ? { pythonPath: expandPath(provider.pythonPath, homeDir) }
        : {}),
      ...(provider.baseURL ? { baseURL: expandPath(provider.baseURL, homeDir) } : {}),
      ...(provider.cacheDir ? { cacheDir: expandPath(provider.cacheDir, homeDir) } : {}),
    };
  }
  return expanded;
}

function expandModelEntryPaths(
  entry: PiProviderYamlModelEntry,
  homeDir: string,
): PiProviderYamlModelEntry {
  return {
    ...entry,
    driverOptions: entry.driverOptions ? { ...entry.driverOptions } : undefined,
  };
}

function expandModelsMapPaths(
  models: NonNullable<Exclude<PiProviderYamlConfig["models"], PiProviderYamlModelEntry[]>>,
  homeDir: string,
): NonNullable<Exclude<PiProviderYamlConfig["models"], PiProviderYamlModelEntry[]>> {
  const expanded: NonNullable<
    Exclude<PiProviderYamlConfig["models"], PiProviderYamlModelEntry[]>
  > = {};

  for (const [logicalName, definition] of Object.entries(models)) {
    expanded[logicalName] = {
      ...definition,
      driverOptions: definition.driverOptions ? { ...definition.driverOptions } : undefined,
    };
  }

  return expanded;
}

function expandPathFields(
  config: PiProviderYamlConfig,
  homeDir: string,
): PiProviderYamlConfig {
  const expandedModels = Array.isArray(config.models)
    ? config.models.map((entry) => expandModelEntryPaths(entry, homeDir))
    : config.models
      ? expandModelsMapPaths(config.models, homeDir)
      : undefined;

  const expanded: PiProviderYamlConfig = {
    ...config,
    models: expandedModels,
    providers: expandProviderPaths(config.providers, homeDir),
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
                ...(config.drivers.mlx.cacheDir
                  ? { cacheDir: expandPath(config.drivers.mlx.cacheDir, homeDir) }
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


function mergeModels(
  base?: PiProviderYamlConfig["models"],
  override?: PiProviderYamlConfig["models"],
): PiProviderYamlConfig["models"] | undefined {
  if (!override) {
    return base;
  }
  if (!base) {
    return override;
  }

  if (Array.isArray(override)) {
    return override;
  }
  if (Array.isArray(base)) {
    return override;
  }

  const merged: NonNullable<
    Exclude<PiProviderYamlConfig["models"], PiProviderYamlModelEntry[]>
  > = { ...base };

  for (const [logicalName, definition] of Object.entries(override)) {
    const baseDefinition = base[logicalName];
    merged[logicalName] = {
      ...baseDefinition,
      ...definition,
      ...(baseDefinition?.defaultQueryOptions || definition.defaultQueryOptions
        ? {
            defaultQueryOptions: {
              ...baseDefinition?.defaultQueryOptions,
              ...definition.defaultQueryOptions,
            },
          }
        : {}),
      ...(baseDefinition?.driverOptions || definition.driverOptions
        ? {
            driverOptions: {
              ...baseDefinition?.driverOptions,
              ...definition.driverOptions,
            },
          }
        : {}),
    };
  }

  return merged;
}

function mergeYamlConfig(
  base: PiProviderYamlConfig,
  override: PiProviderYamlConfig,
): PiProviderYamlConfig {
  const mergedProviders = {
    ...base.providers,
    ...override.providers,
  };

  for (const [name, provider] of Object.entries(override.providers ?? {})) {
    if (provider) {
      mergedProviders[name] = {
        ...base.providers?.[name],
        ...provider,
      };
    }
  }

  return {
    ...base,
    ...override,
    models: mergeModels(base.models, override.models),
    providers: Object.keys(mergedProviders).length > 0 ? mergedProviders : undefined,
    drivers: {
      ...base.drivers,
      ...override.drivers,
      mlx: {
        ...base.drivers?.mlx,
        ...override.drivers?.mlx,
      },
    },
    modelSets: {
      ...base.modelSets,
      ...override.modelSets,
    },
    workflow: {
      ...base.workflow,
      ...override.workflow,
    },
    processes: {
      ...base.processes,
      ...override.processes,
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
  const withDefaultProviderCacheDirs = applyDefaultProviderCacheDirs(merged, scope);
  const withLogging = applyLoggingDefaults(withDefaultProviderCacheDirs, scope);

  return expandPathFields(withLogging, homedir());
}

/**
 * リクエストログ dir を config.yaml から解決する（extract-log CLI 等）。
 * 優先: マージ済み `logging.dir` > グローバルデフォルト。
 * プロジェクト `config.yaml` はファイルが存在すれば trust 済みとしてマージする。
 */
export function resolveConfiguredRequestLogDir(
  options: LoadPiProviderConfigOptions = {},
): string {
  const cwd = options.cwd ?? process.cwd();
  const fileExists = options.fileExists ?? existsSync;
  const paths = resolvePiProviderConfigPaths(cwd);
  const projectConfigExists = fileExists(paths.project);
  const isProjectTrusted = options.isProjectTrusted ?? projectConfigExists;

  const config = loadPiProviderConfig({
    ...options,
    cwd,
    isProjectTrusted,
  });

  if (config.logging?.dir) {
    return config.logging.dir;
  }

  return resolveDefaultLoggingDir({
    cwd,
    isProjectTrusted: false,
    usedProjectConfig: false,
  });
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

function applyDefaultProviderCacheDirs(
  config: PiProviderYamlConfig,
  scope: { cwd: string; isProjectTrusted: boolean; usedProjectConfig: boolean },
): PiProviderYamlConfig {
  const defaultCacheDir = resolveDefaultCacheDir(scope);
  const providers: NonNullable<PiProviderYamlConfig["providers"]> = {
    ...config.providers,
  };

  if (config.drivers?.mlx) {
    providers.mlx = {
      ...providers.mlx,
      ...config.drivers.mlx,
      cacheDir:
        config.drivers.mlx.cacheDir ??
        providers.mlx?.cacheDir ??
        defaultCacheDir,
    };
  }

  for (const [name, provider] of Object.entries(providers)) {
    if (!provider) {
      continue;
    }
    providers[name] = {
      ...provider,
      cacheDir: provider.cacheDir ?? defaultCacheDir,
    };
  }

  if (Object.keys(providers).length === 0) {
    providers.mlx = { cacheDir: defaultCacheDir };
  }

  return {
    ...config,
    providers,
  };
}
