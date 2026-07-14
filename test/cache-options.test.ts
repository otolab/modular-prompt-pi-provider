import { describe, expect, it } from "vitest";
import { resolveDriverCacheOption } from "../src/adapter/cache-options.js";

describe("resolveDriverCacheOption", () => {
  it("cacheDir 未設定時は false", () => {
    expect(resolveDriverCacheOption(undefined, false)).toBe(false);
    expect(resolveDriverCacheOption({ sessionId: "s1" }, false)).toBe(false);
  });

  it("cacheDir 有効時はデフォルト true", () => {
    expect(resolveDriverCacheOption(undefined, true)).toBe(true);
    expect(resolveDriverCacheOption({ sessionId: "s1" }, true)).toBe(true);
    expect(resolveDriverCacheOption({ cacheRetention: "short" }, true)).toBe(true);
    expect(resolveDriverCacheOption({ cacheRetention: "long" }, true)).toBe(true);
  });

  it("cacheRetention none は false", () => {
    expect(resolveDriverCacheOption({ cacheRetention: "none" }, true)).toBe(false);
  });

  it("metadata.cache read-only は read-only", () => {
    expect(
      resolveDriverCacheOption({ metadata: { cache: "read-only" } }, true),
    ).toBe("read-only");
  });
});
