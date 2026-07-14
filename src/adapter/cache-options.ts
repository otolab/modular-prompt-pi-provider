import type { SimpleStreamOptions } from "@earendil-works/pi-ai";
import type { QueryOptions } from "@modular-prompt/driver";

/**
 * Pi のストリームオプションとモデル設定から `QueryOptions.cache` を決める。
 *
 * - `cacheDir` 未設定: MLX は `MlxCacheController` を作らないため `false`
 * - `cacheRetention: "none"`: `false`（Pi の cache 無効相当）
 * - `metadata.cache: "read-only"`: routing 等の read-only 用途
 * - 上記以外かつ `cacheDir` 有効: `true`
 *
 * `cacheRetention` の short/long は MLX の TTL にマップしない（#30 方針）。
 */
export function resolveDriverCacheOption(
  options: SimpleStreamOptions | undefined,
  hasCacheDir: boolean,
): QueryOptions["cache"] {
  if (!hasCacheDir) {
    return false;
  }
  if (options?.cacheRetention === "none") {
    return false;
  }
  if (options?.metadata?.cache === "read-only") {
    return "read-only";
  }
  return true;
}
