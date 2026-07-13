import { describe, expect, it } from "vitest";
import { pickMlxDriverDefaultOptions } from "../src/driver/mlx-options.js";

describe("pickMlxDriverDefaultOptions", () => {
  it("passes through MLX-safe generation params", () => {
    expect(
      pickMlxDriverDefaultOptions({
        maxTokens: 100,
        temperature: 0.5,
        topP: 0.9,
      }),
    ).toEqual({ maxTokens: 100, temperature: 0.5, topP: 0.9 });
  });

  it("strips mode (ModelSpec.defaultOptions に入れてはいけない)", () => {
    expect(
      pickMlxDriverDefaultOptions({
        maxTokens: 100,
        mode: "chat",
      }),
    ).toEqual({ maxTokens: 100 });
  });
});
