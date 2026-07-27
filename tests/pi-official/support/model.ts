import type { Api, Model } from "@earendil-works/pi-ai";
import { API_ID, PROVIDER_BASE_URL, PROVIDER_ID } from "../../../src/constants.js";
import { TEST_LOGICAL_MODEL } from "./test-driver-harness.js";

/** Pi 公式シナリオ向け Model（TestDriver 経路） */
export function buildPiOfficialModel(overrides: Partial<Model<Api>> = {}): Model<Api> {
  return {
    id: TEST_LOGICAL_MODEL,
    name: TEST_LOGICAL_MODEL,
    api: API_ID,
    provider: PROVIDER_ID,
    baseUrl: PROVIDER_BASE_URL,
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    contextWindow: 128_000,
    maxTokens: 8_192,
    ...overrides,
  } as Model<Api>;
}
