import type { Api, Model, SimpleStreamOptions } from "@earendil-works/pi-ai";
import type { QueryOptions } from "@modular-prompt/driver";
import { resolveDriverCacheOption } from "./cache-options.js";

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
