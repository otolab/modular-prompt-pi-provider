import { describe, expect, it } from "vitest";
import {
  DEFAULT_CACHE_POLICY,
  resolveCachePolicy,
} from "../src/cache/cache-policy.js";

describe("resolveCachePolicy", () => {
  it("未指定時はデフォルト", () => {
    expect(resolveCachePolicy()).toEqual(DEFAULT_CACHE_POLICY);
    expect(resolveCachePolicy(undefined)).toEqual(DEFAULT_CACHE_POLICY);
  });

  it("YAML cache セクションをマージする", () => {
    expect(
      resolveCachePolicy({
        maxAgeDays: 3,
        sweepOnStartup: false,
      }),
    ).toEqual({
      maxAgeDays: 3,
      maxSizeGb: DEFAULT_CACHE_POLICY.maxSizeGb,
      minFreeDiskGb: DEFAULT_CACHE_POLICY.minFreeDiskGb,
      sweepOnStartup: false,
      sweepBeforeWrite: DEFAULT_CACHE_POLICY.sweepBeforeWrite,
    });
  });
});
