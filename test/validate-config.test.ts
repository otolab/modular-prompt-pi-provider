import { describe, expect, it } from "vitest";
import { normalizeProviderConfig } from "../src/config/normalize-config.js";
import { validateLogicalModelDefinition } from "../src/config/validate-config.js";

describe("validateProviderConfig", () => {
  it("model に provider / model が無いとエラー", () => {
    expect(() =>
      normalizeProviderConfig({
        models: {
          bad: {
            provider: "",
            model: "mlx-community/x",
            defaultQueryOptions: { maxTokens: 8192 },
          },
        },
      }),
    ).toThrow(/requires provider/);

    expect(() =>
      normalizeProviderConfig({
        models: {
          bad: {
            provider: "mlx",
            model: "",
            defaultQueryOptions: { maxTokens: 8192 },
          },
        },
      }),
    ).toThrow(/requires model/);
  });

  it("processes.model が未登録だとエラー", () => {
    expect(() =>
      normalizeProviderConfig({
        models: {
          gemma: {
            provider: "mlx",
            model: "mlx-community/gemma",
            defaultQueryOptions: { maxTokens: 8192 },
          },
        },
        processes: {
          default: { model: "missing" },
        },
      }),
    ).toThrow(/processes\.default\.model "missing"/);
  });

  it("workflow.modelSet が未定義だとエラー", () => {
    expect(() =>
      normalizeProviderConfig({
        models: {
          gemma: {
            provider: "mlx",
            model: "mlx-community/gemma",
            defaultQueryOptions: { maxTokens: 8192 },
          },
        },
        workflow: {
          agentic: {
            type: "agentic",
            modelSet: "default",
          },
        },
      }),
    ).toThrow(/modelSet "default" is not defined/);
  });

  it("modelSets が存在しない論理名を参照するとエラー", () => {
    expect(() =>
      normalizeProviderConfig({
        models: {
          gemma: {
            provider: "mlx",
            model: "mlx-community/gemma",
            defaultQueryOptions: { maxTokens: 8192 },
          },
        },
        modelSets: {
          default: { chat: "missing" },
        },
      }),
    ).toThrow(/modelSets\.default\.chat "missing"/);
  });

  it("modelSets が virtualModel を参照するとエラー", () => {
    expect(() =>
      normalizeProviderConfig({
        models: {
          gemma: {
            provider: "mlx",
            model: "mlx-community/gemma",
            defaultQueryOptions: { maxTokens: 8192 },
          },
        },
        workflow: {
          agentic: {
            type: "agentic",
            virtualModel: "agentic-chat",
          },
        },
        modelSets: {
          default: { chat: "agentic-chat" },
        },
      }),
    ).toThrow(/must reference a logical model, not virtualModel/);
  });

  it("workflow.type が不正だとエラー", () => {
    expect(() =>
      normalizeProviderConfig({
        models: {
          gemma: {
            provider: "mlx",
            model: "mlx-community/gemma",
            defaultQueryOptions: { maxTokens: 8192 },
          },
        },
        workflow: {
          broken: {
            type: "unknown" as "passthrough",
          },
        },
      }),
    ).toThrow(/workflow\.broken\.type/);
  });

  it("virtualModel の重複はエラー", () => {
    expect(() =>
      normalizeProviderConfig({
        models: {
          gemma: {
            provider: "mlx",
            model: "mlx-community/gemma",
            defaultQueryOptions: { maxTokens: 8192 },
          },
        },
        workflow: {
          a: { type: "agentic", virtualModel: "dup" },
          b: { type: "passthrough", virtualModel: "dup" },
        },
      }),
    ).toThrow(/duplicates workflow\.a\.virtualModel/);
  });
});

describe("validateLogicalModelDefinition", () => {
  it("必須フィールドを個別に検証できる", () => {
    expect(() =>
      validateLogicalModelDefinition("x", {
        provider: "mlx",
        model: "",
        defaultQueryOptions: { maxTokens: 1 },
      }),
    ).toThrow(/requires model/);
  });
});
