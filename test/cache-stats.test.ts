import { describe, expect, it } from "vitest";
import type { AIDriver } from "@modular-prompt/driver";
import { getCacheStats } from "../src/driver/cache-stats.js";

describe("getCacheStats", () => {
  it("cacheController が無い driver は undefined", () => {
    expect(getCacheStats({} as AIDriver)).toBeUndefined();
  });

  it("getStats() の戻り値を返す", () => {
    const stats = {
      totalQueries: 2,
      incremental: 1,
      fresh: 1,
      totalPromptTokens: 100,
      prefillReusedTokens: 40,
      cacheGrowthTokens: 10,
    };
    const driver = {
      cacheController: { getStats: () => stats },
    } as unknown as AIDriver;

    expect(getCacheStats(driver)).toEqual(stats);
  });

  it("getStats が例外を投げたら undefined", () => {
    const driver = {
      cacheController: {
        getStats: () => {
          throw new Error("not bound");
        },
      },
    } as unknown as AIDriver;

    expect(getCacheStats(driver)).toBeUndefined();
  });
});
