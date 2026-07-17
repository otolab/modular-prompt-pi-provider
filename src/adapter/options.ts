import type { QueryOptions } from "@modular-prompt/driver";
import type { Api, Model, SimpleStreamOptions } from "@earendil-works/pi-ai";
import { resolveDriverCacheOption } from "./cache-options.js";

/** defaultQueryOptions と Pi 側オプションをマージする（override 優先） */
export function mergeQueryOptions(
  base: QueryOptions,
  override: QueryOptions,
): QueryOptions {
  return {
    ...base,
    ...override,
    ...(base.tools || override.tools
      ? { tools: override.tools ?? base.tools }
      : {}),
  };
}

/**
 * Pi SimpleStreamOptions → driver QueryOptions。
 *
 * DRIVER_API / driver-usage スキルに掲載のフィールドのみ使う:
 * - `stream`, `temperature`, `maxTokens`, `signal`, `reasoningEffort`, `cache`
 * - `mode` は指定しない（MLX は apiStrategy auto + chat template で API 選択）
 */
export function piOptionsToQueryOptions(
  options: SimpleStreamOptions | undefined,
  _model: Model<Api>,
  hasCacheDir = false,
): QueryOptions {
  const reasoningEffort =
    options?.reasoning === "low" ||
    options?.reasoning === "medium" ||
    options?.reasoning === "high"
      ? options.reasoning
      : undefined;

  return {
    stream: true,
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
    reasoningEffort,
    signal: options?.signal,
    cache: resolveDriverCacheOption(options, hasCacheDir),
  };
}
