import type { Api, Model, Usage } from "@earendil-works/pi-ai";
import { calculateCost } from "@earendil-works/pi-ai";
import type { QueryResult } from "@modular-prompt/driver";

export function mapQueryResultUsageToPi(result: QueryResult, model: Model<Api>): Usage {
  const promptTokens = result.usage?.promptTokens ?? 0;
  const completionTokens = result.usage?.completionTokens ?? 0;
  const cacheRead = result.usage?.cacheReadTokens ?? 0;
  const cacheWrite = result.usage?.cacheWriteTokens ?? 0;
  const input = Math.max(0, promptTokens - cacheRead - cacheWrite);

  const usage: Usage = {
    input,
    output: completionTokens,
    cacheRead,
    cacheWrite,
    totalTokens: input + completionTokens + cacheRead + cacheWrite,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
  calculateCost(model, usage);
  return usage;
}
