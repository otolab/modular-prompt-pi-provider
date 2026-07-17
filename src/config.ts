import type { ApplicationConfig, ModelSpec } from "@modular-prompt/driver";
import type { PiProviderYamlConfig } from "./pi-provider-config.js";
import { DEFAULT_MODEL_FALLBACK } from "./constants.js";
import { normalizeProviderConfig } from "./config/normalize-config.js";
import type { ResolvedLogicalModel, ResolvedProviderConfig } from "./config/types.js";

/** @deprecated {@link DEFAULT_MODEL_FALLBACK} を使用 */
export { DEFAULT_MODEL_FALLBACK } from "./constants.js";

function resolveDefaultModelId(): string {
  return process.env.MODULAR_PROMPT_PI_MODEL ?? DEFAULT_MODEL_FALLBACK;
}

/** @deprecated {@link resolveDefaultModelId} を使用 */
export const DEFAULT_MLX_MODEL = resolveDefaultModelId();

/**
 * YAML + 環境変数 + コードデフォルトから ApplicationConfig を組み立てる。
 * 優先度: YAML models > MODULAR_PROMPT_PI_MODEL > DEFAULT_MODEL_FALLBACK
 */
export function createApplicationConfig(
  yamlConfig?: PiProviderYamlConfig,
  overrides?: Partial<ApplicationConfig>,
): ApplicationConfig {
  const resolved = normalizeProviderConfig(yamlConfig);
  return {
    ...resolved.applicationConfig,
    ...overrides,
    models: overrides?.models ?? resolved.applicationConfig.models,
    drivers: overrides?.drivers ?? resolved.applicationConfig.drivers,
  };
}

export function createResolvedProviderConfig(
  yamlConfig?: PiProviderYamlConfig,
  overrides?: Partial<ApplicationConfig>,
): ResolvedProviderConfig {
  const resolved = normalizeProviderConfig(yamlConfig);
  if (!overrides?.models) {
    return {
      ...resolved,
      applicationConfig: {
        ...resolved.applicationConfig,
        ...overrides,
      },
    };
  }

  return mergeDiscoveredModels(resolved, overrides.models, overrides);
}

/** discovery 後の ModelSpec を論理モデル Map に反映する */
export function mergeDiscoveredModels(
  resolved: ResolvedProviderConfig,
  discoveredModels: ModelSpec[],
  overrides?: Partial<ApplicationConfig>,
): ResolvedProviderConfig {
  const byPhysical = new Map(discoveredModels.map((spec) => [spec.model, spec]));
  const updatedLogical = new Map<string, ResolvedLogicalModel>();

  for (const [logicalName, logicalModel] of resolved.logicalModels) {
    const discovered = byPhysical.get(logicalModel.physicalModel);
    updatedLogical.set(logicalName, {
      ...logicalModel,
      spec: discovered ?? logicalModel.spec,
    });
  }

  return {
    ...resolved,
    logicalModels: updatedLogical,
    applicationConfig: {
      ...resolved.applicationConfig,
      ...overrides,
      models: discoveredModels,
    },
  };
}

/** 論理名で ModelSpec を取得する（Pi model.id = 論理名） */
export function findModelSpec(
  config: ApplicationConfig | ResolvedProviderConfig,
  logicalName: string,
): ModelSpec | undefined {
  if ("logicalModels" in config) {
    return config.logicalModels.get(logicalName)?.spec;
  }

  // FIXME(#40): ApplicationConfig には論理名マップがない。呼び出しは ResolvedProviderConfig に統一する。
  return normalizeProviderConfigFromApplication(config, logicalName);
}

function normalizeProviderConfigFromApplication(
  config: ApplicationConfig,
  logicalName: string,
): ModelSpec | undefined {
  return config.models?.find((spec) => spec.model === logicalName);
}

export function modelHasCacheDir(
  config: ApplicationConfig | ResolvedProviderConfig,
  logicalName: string,
): boolean {
  const cacheDir = findModelSpec(config, logicalName)?.driverOptions?.cacheDir;
  return typeof cacheDir === "string" && cacheDir.length > 0;
}

export function getEnabledLogicalModels(
  config: ResolvedProviderConfig,
): ResolvedProviderConfig["logicalModels"] {
  return new Map(
    [...config.logicalModels.entries()].filter(([, model]) => !model.disabled),
  );
}

export type { ResolvedProviderConfig } from "./config/types.js";
export { normalizeProviderConfig } from "./config/normalize-config.js";
export {
  resolveSelection,
  resolveProcessFallback,
  resolveDefaultSelection,
  resolveStreamSelection,
  formatStreamSelectionError,
} from "./config/resolve-selection.js";
