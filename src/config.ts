import type { ApplicationConfig, ModelSpec } from "@modular-prompt/driver";

/** 環境変数 `MODULAR_PROMPT_PI_MODEL` で上書き可能 */
export const DEFAULT_MLX_MODEL =
  process.env.MODULAR_PROMPT_PI_MODEL ??
  "mlx-community/gemma-4-26B-A4B-it-heretic-4bit";

function buildDefaultModelSpec(model: string): ModelSpec {
  return {
    model,
    provider: "mlx",
    capabilities: [
      "streaming",
      "local",
      "multilingual",
      "chat",
      "tools",
      "reasoning",
      "vision",
      "function-calling",
    ],
    maxInputTokens: 128_000,
    maxOutputTokens: 8_192,
    priority: 10,
    defaultOptions: {
      mode: "chat",
      maxTokens: 8_192,
    },
  };
}

/** 固定 ApplicationConfig（M1）。モデル追加は `models` 配列を拡張する */
export function createApplicationConfig(
  overrides?: Partial<ApplicationConfig>,
): ApplicationConfig {
  const model = DEFAULT_MLX_MODEL;
  return {
    models: [buildDefaultModelSpec(model)],
    ...overrides,
  };
}

export function findModelSpec(
  config: ApplicationConfig,
  modelId: string,
): ModelSpec | undefined {
  return config.models?.find((spec) => spec.model === modelId);
}
