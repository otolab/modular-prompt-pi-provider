import type { Api, Model } from "@earendil-works/pi-ai";
import { API_ID, PROVIDER_ID } from "../../../src/constants.js";

/** integration 用 Pi Model（model.id は論理名 or virtualModel） */
export function buildPiModel(modelId: string): Model<Api> {
  return {
    id: modelId,
    name: modelId,
    api: API_ID,
    provider: PROVIDER_ID,
    baseUrl: "local://integration",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    contextWindow: 128_000,
    maxTokens: 128,
  } as Model<Api>;
}
