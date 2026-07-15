import type {
  ApplicationConfig,
  DriverCapability,
  DriverProvider,
  ModelSpec,
} from "@modular-prompt/driver";
import type { PiProviderYamlConfig, PiProviderYamlModelEntry } from "./pi-provider-config.js";
import { pickMlxDriverDefaultOptions } from "./driver/mlx-options.js";

/** コードデフォルト（優先度最低） */
export const DEFAULT_MODEL_FALLBACK =
  "mlx-community/gemma-4-26B-A4B-it-heretic-4bit";

const DEFAULT_CAPABILITIES: DriverCapability[] = [
  "streaming",
  "local",
  "multilingual",
  "japanese",
  "chat",
  "tools",
  "reasoning",
  "function-calling",
];

/** @deprecated {@link resolveDefaultModelId} を使用 */
export const DEFAULT_MLX_MODEL = resolveDefaultModelId();

function resolveDefaultModelId(): string {
  return process.env.MODULAR_PROMPT_PI_MODEL ?? DEFAULT_MODEL_FALLBACK;
}

function yamlModelToSpec(entry: PiProviderYamlModelEntry): ModelSpec {
  const defaultOptions = pickMlxDriverDefaultOptions(entry.defaultOptions);
  const maxOutputTokens =
    entry.maxOutputTokens ?? entry.defaultOptions?.maxTokens ?? 8_192;

  return {
    model: entry.model,
    provider: (entry.provider ?? "mlx") as DriverProvider,
    capabilities: (entry.capabilities ?? DEFAULT_CAPABILITIES) as DriverCapability[],
    ...(entry.maxInputTokens != null ? { maxInputTokens: entry.maxInputTokens } : {}),
    maxOutputTokens,
    priority: entry.priority ?? 10,
    ...(defaultOptions ? { defaultOptions } : {}),
    ...(entry.driverOptions ? { driverOptions: entry.driverOptions } : {}),
  };
}

function buildDefaultModelSpec(model: string): ModelSpec {
  const defaultOptions = pickMlxDriverDefaultOptions({
    maxTokens: 8_192,
  });

  return {
    model,
    provider: "mlx",
    capabilities: DEFAULT_CAPABILITIES,
    maxOutputTokens: 8_192,
    priority: 10,
    ...(defaultOptions ? { defaultOptions } : {}),
  };
}

/**
 * YAML + 環境変数 + コードデフォルトから ApplicationConfig を組み立てる。
 * 優先度: YAML models > MODULAR_PROMPT_PI_MODEL > DEFAULT_MODEL_FALLBACK
 */
export function createApplicationConfig(
  yamlConfig?: PiProviderYamlConfig,
  overrides?: Partial<ApplicationConfig>,
): ApplicationConfig {
  const models =
    yamlConfig?.models?.length
      ? yamlConfig.models.map(yamlModelToSpec)
      : [buildDefaultModelSpec(resolveDefaultModelId())];

  return {
    ...(yamlConfig?.drivers ? { drivers: yamlConfig.drivers } : {}),
    models,
    ...overrides,
  };
}

export function findModelSpec(
  config: ApplicationConfig,
  modelId: string,
): ModelSpec | undefined {
  return config.models?.find((spec) => spec.model === modelId);
}

export function modelHasCacheDir(config: ApplicationConfig, modelId: string): boolean {
  const cacheDir = findModelSpec(config, modelId)?.driverOptions?.cacheDir;
  return typeof cacheDir === "string" && cacheDir.length > 0;
}
