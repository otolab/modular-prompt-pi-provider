import { afterEach, describe, expect, it, vi } from "vitest";
import { createApplicationConfig } from "../src/config.js";
import {
  getCacheDirs,
  getCachePolicy,
  initCacheRuntime,
  resetCacheRuntime,
  sweepAllCaches,
  sweepCacheDirBeforeWrite,
} from "../src/cache/runtime.js";
import * as cacheManagerModule from "../src/cache/cache-manager.js";

describe("cache runtime", () => {
  afterEach(() => {
    resetCacheRuntime();
    vi.restoreAllMocks();
  });

  it("initCacheRuntime で policy と cacheDirs を設定する", () => {
    const appConfig = createApplicationConfig({
      models: [
        {
          model: "m1",
          provider: "mlx",
          defaultQueryOptions: { maxTokens: 8192 },
          driverOptions: { cacheDir: "/tmp/cache-a" },
        },
        {
          model: "m2",
          provider: "mlx",
          defaultQueryOptions: { maxTokens: 8192 },
          driverOptions: { cacheDir: "/tmp/cache-a" },
        },
        {
          model: "m3",
          provider: "mlx",
          defaultQueryOptions: { maxTokens: 8192 },
          driverOptions: { cacheDir: "/tmp/cache-b" },
        },
      ],
    });

    initCacheRuntime(
      {
        cache: { maxAgeDays: 14, sweepOnStartup: false },
      },
      appConfig,
    );

    expect(getCachePolicy().maxAgeDays).toBe(14);
    expect(getCachePolicy().sweepOnStartup).toBe(false);
    expect(getCacheDirs().sort()).toEqual(["/tmp/cache-a", "/tmp/cache-b"]);
  });

  it("sweepBeforeWrite 無効時は clean を呼ばない", async () => {
    const appConfig = createApplicationConfig({
      models: [
        {
          model: "m1",
          provider: "mlx",
          defaultQueryOptions: { maxTokens: 8192 },
          driverOptions: { cacheDir: "/tmp/cache-x" },
        },
      ],
    });
    initCacheRuntime({ cache: { sweepBeforeWrite: false } }, appConfig);

    const clean = vi
      .spyOn(cacheManagerModule.CacheManager.prototype, "clean")
      .mockResolvedValue({
        cacheDir: "/tmp/cache-x",
        deleted: [],
        kept: 0,
        freedMb: 0,
        dryRun: false,
      });

    await sweepCacheDirBeforeWrite("/tmp/cache-x");
    expect(clean).not.toHaveBeenCalled();
  });

  it("sweepAllCaches は登録済み cacheDir ごとに clean する", async () => {
    const appConfig = createApplicationConfig({
      models: [
        {
          model: "m1",
          provider: "mlx",
          defaultQueryOptions: { maxTokens: 8192 },
          driverOptions: { cacheDir: "/tmp/c1" },
        },
        {
          model: "m2",
          provider: "mlx",
          defaultQueryOptions: { maxTokens: 8192 },
          driverOptions: { cacheDir: "/tmp/c2" },
        },
      ],
    });
    initCacheRuntime(undefined, appConfig);

    const clean = vi
      .spyOn(cacheManagerModule.CacheManager.prototype, "clean")
      .mockResolvedValue({
        cacheDir: "",
        deleted: [],
        kept: 0,
        freedMb: 0,
        dryRun: false,
      });

    await sweepAllCaches({ dryRun: true, trigger: "manual" });
    expect(clean).toHaveBeenCalledTimes(2);
    expect(clean).toHaveBeenCalledWith({ dryRun: true });
  });
});
