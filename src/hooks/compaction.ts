import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { runPiCompact } from "../compact/adapters/pi-hook.js";
import { createCompactWorkflowLogger } from "../compact/logging.js";
import { beginRequestLog } from "../logging/runtime.js";
import { resolveCompactStrategy } from "../compact/registry.js";
import { STREAM_SUMMARIZE_STRATEGY_ID } from "../compact/strategies/stream-summarize/run.js";
import { resolveSelection } from "../config/resolve-selection.js";
import { getDriverForLogicalModel } from "../driver/model-registry.js";
import { getResolvedProviderConfig } from "../driver/service.js";

function logSessionCompact(event: {
  reason: "manual" | "threshold" | "overflow";
  willRetry: boolean;
  fromExtension: boolean;
  compactionEntry: {
    summary: string;
    firstKeptEntryId: string;
    tokensBefore: number;
    fromHook?: boolean;
  };
}): void {
  const requestLog = beginRequestLog();
  if (!requestLog) {
    return;
  }

  void requestLog.logOut("compact_complete", {
    reason: event.reason,
    willRetry: event.willRetry,
    fromExtension: event.fromExtension,
    tokensBefore: event.compactionEntry.tokensBefore,
    summaryLength: event.compactionEntry.summary.length,
    firstKeptEntryId: event.compactionEntry.firstKeptEntryId,
    fromHook: event.compactionEntry.fromHook,
  });
}

export function registerCompactionHooks(pi: ExtensionAPI): void {
  pi.on("session_compact", async (event) => {
    const config = getResolvedProviderConfig();
    if (!config.processes.compaction?.model) {
      return;
    }

    logSessionCompact(event);
  });

  pi.on("session_before_compact", async (event, ctx) => {
    const config = getResolvedProviderConfig();
    const compactionModel = config.processes.compaction?.model;
    if (!compactionModel) {
      return;
    }

    const selection = resolveSelection(compactionModel, config);
    if (!selection || selection.kind !== "logical") {
      ctx.ui.notify(
        `processes.compaction.model "${compactionModel}" must be a logical model`,
        "warning",
      );
      return;
    }

    const strategyId =
      config.compact?.strategy ?? STREAM_SUMMARIZE_STRATEGY_ID;
    try {
      resolveCompactStrategy(strategyId);
    } catch {
      ctx.ui.notify(`Unknown compact.strategy "${strategyId}"`, "warning");
      return;
    }

    const { preparation, signal, customInstructions } = event;
    if (signal.aborted) {
      return { cancel: true };
    }

    try {
      const requestLog = beginRequestLog();
      const logger = requestLog
        ? createCompactWorkflowLogger(requestLog)
        : undefined;

      const compaction = await runPiCompact({
        strategyId,
        preparation,
        customInstructions,
        targetTokens: config.compact?.targetTokens,
        tokenLimit: config.compact?.tokenLimit,
        maxChunk: config.compact?.maxChunk,
        signal,
        compactionModel: selection.logicalName,
        getDriver: getDriverForLogicalModel,
        logger,
      });

      if (signal.aborted) {
        return { cancel: true };
      }

      if (!compaction) {
        return;
      }

      ctx.ui.notify(
        `Compact (${strategyId}): ${compaction.tokensBefore.toLocaleString()} tokens summarized`,
        "info",
      );

      return { compaction };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!signal.aborted) {
        ctx.ui.notify(`Compaction failed: ${message}`, "error");
      }
      return;
    }
  });
}
