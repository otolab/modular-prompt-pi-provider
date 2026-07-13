import { describe, expect, it } from "vitest";
import { DEFAULT_MLX_MODEL, createApplicationConfig, findModelSpec } from "../src/config.js";
import { modelSpecToPiProviderModel } from "../src/driver/model-catalog.js";

describe("config", () => {
  it("defaults to gemma heretic 4bit model", () => {
    expect(DEFAULT_MLX_MODEL).toBe(
      "mlx-community/gemma-4-26B-A4B-it-heretic-4bit",
    );
  });

  it("registers default model in ApplicationConfig", () => {
    const config = createApplicationConfig();
    const spec = findModelSpec(config, DEFAULT_MLX_MODEL);
    expect(spec?.provider).toBe("mlx");
    expect(spec?.capabilities).toContain("streaming");
  });

  it("defaultOptions は MLX python 層に渡るフィールドのみ", () => {
    const config = createApplicationConfig();
    const spec = findModelSpec(config, DEFAULT_MLX_MODEL);
    expect(spec?.defaultOptions).toEqual({ maxTokens: 8_192 });
    expect(spec?.defaultOptions).not.toHaveProperty("mode");
  });

  it("maps ModelSpec to Pi provider model", () => {
    const config = createApplicationConfig();
    const spec = config.models![0]!;
    const piModel = modelSpecToPiProviderModel(spec);
    expect(piModel.id).toBe(DEFAULT_MLX_MODEL);
    expect(piModel.reasoning).toBe(true);
    expect(piModel.input).toEqual(["text"]);
  });
});
