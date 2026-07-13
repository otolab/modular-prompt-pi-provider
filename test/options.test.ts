import { describe, expect, it } from "vitest";
import { piOptionsToQueryOptions } from "../src/adapter/options.js";
import type { Api, Model } from "@earendil-works/pi-ai";
import type { QueryResult } from "@modular-prompt/driver";

const model = {
  id: "test-model",
  api: "modular-prompt-mlx",
  provider: "modular-prompt-mlx",
} as Model<Api>;

describe("piOptionsToQueryOptions", () => {
  it("sets stream true and maps temperature / maxTokens", () => {
    expect(
      piOptionsToQueryOptions({ temperature: 0.5, maxTokens: 100 }, model),
    ).toEqual({
      stream: true,
      temperature: 0.5,
      maxTokens: 100,
    });
  });

  it("maps reasoning to thinking mode", () => {
    expect(piOptionsToQueryOptions({ reasoning: "high" }, model)).toEqual({
      stream: true,
      mode: "thinking",
      reasoningEffort: "high",
    });
  });

  it("propagates AbortSignal", () => {
    const controller = new AbortController();
    const opts = piOptionsToQueryOptions({ signal: controller.signal }, model);
    expect(opts.signal).toBe(controller.signal);
  });
});
