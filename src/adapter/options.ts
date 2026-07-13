import type { Api, Model, SimpleStreamOptions } from "@earendil-works/pi-ai";
import type { QueryOptions } from "@modular-prompt/driver";

export function piOptionsToQueryOptions(
  options: SimpleStreamOptions | undefined,
  _model: Model<Api>,
): QueryOptions {
  const query: QueryOptions = {
    stream: true,
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
  };

  const level = options?.reasoning;
  if (level) {
    query.mode = "thinking";
    if (level === "low" || level === "medium" || level === "high") {
      query.reasoningEffort = level;
    }
  }

  if (options?.signal) {
    query.signal = options.signal;
  }

  return query;
}
