import type { RequestLogger } from "../logging/request-logger.js";
import type { AgenticWorkflowLogger } from "../workflow/agentic-logging.js";

const AGENTIC_PHASE = "agentic";

/** RequestLogger を agentic workflow 用ロガーに変換する */
export function createAgenticRequestLogger(
  requestLog: RequestLogger,
): AgenticWorkflowLogger {
  return {
    logPrompt: (content, metadata) =>
      requestLog.logPrompt(AGENTIC_PHASE, content, metadata),
    logTaskRegistration: (tasks) =>
      requestLog.logTaskRegistration(AGENTIC_PHASE, tasks),
    logLlmResponse: (data, model) =>
      requestLog.logLlmResponse(AGENTIC_PHASE, data, model),
    logError: (message, data) =>
      requestLog.logError(AGENTIC_PHASE, message, data),
    logCacheStats: (stats) => requestLog.logCacheStats(AGENTIC_PHASE, stats),
  };
}
