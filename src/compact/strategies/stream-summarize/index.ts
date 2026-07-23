import type { CompactStrategy } from "../../strategy.js";
import { runStreamSummarizeStrategy, STREAM_SUMMARIZE_STRATEGY_ID } from "./run.js";

export { createStreamSummarizeModule, loadStreamSummarizeProcedure } from "./module.js";
export { runStreamSummarizeStrategy, STREAM_SUMMARIZE_STRATEGY_ID } from "./run.js";

export const streamSummarizeStrategy: CompactStrategy = {
  id: STREAM_SUMMARIZE_STRATEGY_ID,
  run: runStreamSummarizeStrategy,
};
