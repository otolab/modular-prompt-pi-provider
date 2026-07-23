import type { CompactStrategy } from "../../strategy.js";
import {
  runSummarizeProcessStrategy,
  SUMMARIZE_PROCESS_STRATEGY_ID,
} from "./run.js";

export {
  createSummarizeProcessModule,
  loadSummarizeProcessProcedure,
} from "./module.js";
export {
  DEFAULT_SUMMARIZE_TARGET_TOKENS,
  runSummarizeProcessStrategy,
  SUMMARIZE_PROCESS_STRATEGY_ID,
} from "./run.js";

export const summarizeProcessStrategy: CompactStrategy = {
  id: SUMMARIZE_PROCESS_STRATEGY_ID,
  run: runSummarizeProcessStrategy,
};
