import type { RequestLogger } from "../logging/request-logger.js";
import type { CompactInput, CompactResult } from "./types.js";

const COMPACT_PHASE = "compact";

/** compact workflow の JSONL ログ */
export interface CompactWorkflowLogger {
  logStart(strategyId: string, input: CompactInput): Promise<void>;
  logResult(result: CompactResult): Promise<void>;
  logError(message: string, data?: unknown): Promise<void>;
}

/** RequestLogger を compact 用ロガーに変換する */
export function createCompactWorkflowLogger(
  requestLog: RequestLogger,
): CompactWorkflowLogger {
  return {
    logStart: async (strategyId, input) => {
      await requestLog.logIn(COMPACT_PHASE, {
        strategyId,
        chunkCount: input.chunks.length,
        targetTokens: input.targetTokens,
        hasState: Boolean(input.state?.content),
      });
    },
    logResult: async (result) => {
      await requestLog.logOut(COMPACT_PHASE, {
        summaryLength: result.summary.length,
        stateUsage: result.state.usage,
      });
      await requestLog.logLlmResponse(COMPACT_PHASE, {
        content: result.summary,
      });
    },
    logError: async (message, data) => {
      await requestLog.logError(COMPACT_PHASE, message, data);
    },
  };
}
