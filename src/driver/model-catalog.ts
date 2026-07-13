import type { ModelSpec } from "@modular-prompt/driver";

/** Pi `registerProvider` 用のモデル定義（ProviderModelConfig 相当） */
export interface PiProviderModel {
  id: string;
  name: string;
  reasoning: boolean;
  input: ("text" | "image")[];
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
  contextWindow: number;
  maxTokens: number;
}

export function modelSpecToPiProviderModel(spec: ModelSpec): PiProviderModel {
  const shortName = spec.model.includes("/")
    ? (spec.model.split("/").pop() ?? spec.model)
    : spec.model;

  return {
    id: spec.model,
    name: shortName,
    reasoning: spec.capabilities.includes("reasoning"),
    input: spec.capabilities.includes("vision") ? ["text", "image"] : ["text"],
    cost: {
      input: spec.cost?.input ?? 0,
      output: spec.cost?.output ?? 0,
      cacheRead: 0,
      cacheWrite: 0,
    },
    contextWindow: spec.maxInputTokens ?? 128_000,
    maxTokens: spec.maxOutputTokens ?? 8_192,
  };
}
