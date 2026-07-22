import type { AIDriver } from "@modular-prompt/driver";

/** `MlxCacheController.getStats()` の戻り値（sprite-claude `CacheStats` 相当） */
export interface MlxCacheStats {
  totalQueries: number;
  incremental: number;
  fresh: number;
  totalPromptTokens: number;
  prefillReusedTokens: number;
  cacheGrowthTokens: number;
}

interface CacheControllerLike {
  getStats?: () => MlxCacheStats;
}

/**
 * driver の cacheController から KV キャッシュ統計を取得する。
 * cacheDir 未設定・VLM 等でコントローラが無い場合は undefined。
 */
export function getCacheStats(driver: AIDriver): MlxCacheStats | undefined {
  const ctrl = (driver as { cacheController?: CacheControllerLike }).cacheController;
  if (!ctrl || typeof ctrl.getStats !== "function") {
    return undefined;
  }

  try {
    return ctrl.getStats();
  } catch {
    return undefined;
  }
}

/**
 * DriverSet 内のユニーク driver から KV キャッシュ統計を取得する。
 * 同一 driver が複数 role に割り当てられている場合は重複除外する。
 */
export function getAllCacheStats(
  driverSet: Record<string, AIDriver>,
): Record<string, MlxCacheStats> {
  const seen = new Set<AIDriver>();
  const result: Record<string, MlxCacheStats> = {};

  for (const [role, driver] of Object.entries(driverSet)) {
    if (seen.has(driver)) continue;
    seen.add(driver);
    const stats = getCacheStats(driver);
    if (stats) {
      result[role] = stats;
    }
  }

  return result;
}
