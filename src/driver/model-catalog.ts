import type { ModelSpec } from "@modular-prompt/driver";
import type { ResolvedProviderConfig } from "../config/types.js";

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

export function modelSpecToPiProviderModel(
  logicalName: string,
  spec: ModelSpec,
): PiProviderModel {
  const shortName = logicalName.includes("/")
    ? (logicalName.split("/").pop() ?? logicalName)
    : logicalName;

  return {
    id: logicalName,
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

/** 正規化済み config から Pi モデル一覧を構築する（論理名 + virtualModel） */
export function buildPiProviderModels(config: ResolvedProviderConfig): PiProviderModel[] {
  const models: PiProviderModel[] = [];

  for (const [logicalName, logicalModel] of config.logicalModels) {
    if (logicalModel.disabled) {
      continue;
    }
    models.push(modelSpecToPiProviderModel(logicalName, logicalModel.spec));
  }

  for (const [virtualName, virtual] of config.virtualModels) {
    models.push({
      id: virtualName,
      name: virtualName,
      reasoning: virtual.workflow.type === "agentic",
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128_000,
      maxTokens: 8_192,
    });
  }

  return models;
}
