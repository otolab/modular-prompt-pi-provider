import { describe, expect, it } from "vitest";
import { mapQueryResultUsageToPi } from "../src/adapter/usage.js";
import type { Api, Model } from "@earendil-works/pi-ai";
import type { QueryResult } from "@modular-prompt/driver";

const model = {
  id: "test-model",
  api: "modular-prompt-mlx",
  provider: "modular-prompt-mlx",
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
} as Model<Api>;

describe("mapQueryResultUsageToPi", () => {
  it("computes input from prompt minus cache fields", () => {
    const result: QueryResult = {
      content: "x",
      usage: {
        promptTokens: 100,
        completionTokens: 20,
        totalTokens: 120,
        cacheReadTokens: 30,
        cacheWriteTokens: 10,
      },
    };

    const usage = mapQueryResultUsageToPi(result, model);
    expect(usage.input).toBe(60);
    expect(usage.output).toBe(20);
    expect(usage.cacheRead).toBe(30);
    expect(usage.cacheWrite).toBe(10);
    expect(usage.totalTokens).toBe(120);
  });

  it("defaults missing usage to zeros", () => {
    const usage = mapQueryResultUsageToPi({ content: "" }, model);
    expect(usage.input).toBe(0);
    expect(usage.output).toBe(0);
    expect(usage.totalTokens).toBe(0);
  });
});
