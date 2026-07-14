import { describe, expect, it } from "vitest";
import { piOptionsToQueryOptions } from "../src/adapter/options.js";
import type { Api, Model } from "@earendil-works/pi-ai";

const model = {
  id: "test-model",
  api: "modular-prompt-provider",
  provider: "modular-prompt-provider",
} as Model<Api>;

describe("piOptionsToQueryOptions", () => {
  it("sets stream and maps temperature / maxTokens", () => {
    expect(
      piOptionsToQueryOptions({ temperature: 0.5, maxTokens: 100 }, model),
    ).toEqual({
      stream: true,
      temperature: 0.5,
      maxTokens: 100,
    });
  });

  it("maps reasoning to reasoningEffort (not mode)", () => {
    expect(piOptionsToQueryOptions({ reasoning: "high" }, model)).toEqual({
      stream: true,
      reasoningEffort: "high",
    });
  });

  it("propagates AbortSignal", () => {
    const controller = new AbortController();
    const opts = piOptionsToQueryOptions({ signal: controller.signal }, model);
    expect(opts.signal).toBe(controller.signal);
    expect(opts).not.toHaveProperty("mode");
  });
});
