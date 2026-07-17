import type {
  Api,
  AssistantMessageEventStream,
  Context,
  Model,
  SimpleStreamOptions,
} from "@earendil-works/pi-ai";
import { isAborted, formatCompletionPrompt } from "@modular-prompt/driver";
import { sweepCacheDirBeforeWrite } from "../cache/runtime.js";
import { findModelSpec, formatStreamSelectionError, modelHasCacheDir, resolveStreamSelection } from "../config.js";
import { getDriverForLogicalModel } from "../driver/pool.js";
import { getCacheStats } from "../driver/cache-stats.js";
import { getResolvedProviderConfig } from "../driver/service.js";
import { setActiveStreamSessionId } from "../cache/session-context.js";
import { beginRequestLog } from "../logging/runtime.js";
import { piContextToCompiledPrompt } from "./context-to-prompt.js";
import { resolveStreamTermination } from "./finish-reason.js";
import {
  appendTextBlock,
  createInitialAssistantMessage,
  getTextBlock,
} from "./message-mapper.js";
import { mergeQueryOptions, piOptionsToQueryOptions } from "./options.js";
import { emitToolCallsFromResult } from "./toolcall-emitter.js";
import { piToolsToToolDefinitions } from "./tools.js";
import { mapQueryResultUsageToPi } from "./usage.js";
import { pickMlxDriverDefaultOptions } from "../driver/mlx-options.js";
import { buildPassthroughRequest, runLogicalPassthroughStream } from "../workflow/index.js";

const PHASE3_VIRTUAL_MODEL_ERROR = "workflow execution not implemented (Phase 3)";

export async function bridgeDriverStreamToPi(
  model: Model<Api>,
  context: Context,
  options: SimpleStreamOptions | undefined,
  piStream: AssistantMessageEventStream,
): Promise<void> {
  const output = createInitialAssistantMessage(model);
  piStream.push({ type: "start", partial: output });
  const workPhase = "stream";
  const requestLog = beginRequestLog();

  try {
    if (isAborted(options?.signal)) {
      output.stopReason = "aborted";
      piStream.push({ type: "error", reason: "aborted", error: output });
      piStream.end();
      return;
    }

    const resolvedConfig = getResolvedProviderConfig();
    const selection = resolveStreamSelection(model.id, resolvedConfig);

    if (!selection) {
      throw new Error(formatStreamSelectionError(model.id, resolvedConfig));
    }

    if (selection.kind === "virtual") {
      throw new Error(PHASE3_VIRTUAL_MODEL_ERROR);
    }

    const logicalName = selection.logicalName;
    const modelSpec = findModelSpec(resolvedConfig, logicalName);
    const hasCacheDir = modelHasCacheDir(resolvedConfig, logicalName);
    setActiveStreamSessionId(options?.sessionId);

    const defaultQueryOptions = pickMlxDriverDefaultOptions(
      selection.model.defaultQueryOptions,
    );
    const piQueryOpts = piOptionsToQueryOptions(options, model, hasCacheDir);
    const queryOpts = mergeQueryOptions(
      {
        stream: true,
        ...defaultQueryOptions,
      },
      {
        ...piQueryOpts,
        ...(context.tools?.length
          ? {
              tools: piToolsToToolDefinitions(context.tools),
              toolChoice: "auto" as const,
            }
          : {}),
      },
    );

    if (requestLog) {
      await requestLog.logIn("request", {
        model: model.id,
        logicalModel: logicalName,
        sessionId: options?.sessionId,
        messageCount: context.messages.length,
        hasTools: Boolean(context.tools?.length),
        cache: queryOpts.cache,
      });
      await requestLog.logDriverInfo(workPhase, {
        model: logicalName,
        physicalModel: modelSpec?.model,
        provider: modelSpec?.provider,
        capabilities: modelSpec?.capabilities,
        cacheDir: modelSpec?.driverOptions?.cacheDir,
      });
    }

    if (hasCacheDir && queryOpts.cache === true) {
      const cacheDir = modelSpec?.driverOptions?.cacheDir;
      if (cacheDir) {
        await sweepCacheDirBeforeWrite(cacheDir);
      }
    }

    const driver = await getDriverForLogicalModel(logicalName);
    const prompt = piContextToCompiledPrompt(context);
    const workflowRequest = buildPassthroughRequest(prompt, queryOpts);

    if (requestLog) {
      await requestLog.logPrompt(workPhase, formatCompletionPrompt(prompt));
    }

    const { stream, result } = await runLogicalPassthroughStream(
      selection,
      driver,
      workflowRequest,
    );

    const textIndex = appendTextBlock(output, "");
    piStream.push({ type: "text_start", contentIndex: textIndex, partial: output });

    for await (const chunk of stream) {
      if (isAborted(options?.signal)) {
        break;
      }
      const block = getTextBlock(output, textIndex);
      if (block) {
        block.text += chunk;
        piStream.push({
          type: "text_delta",
          contentIndex: textIndex,
          delta: chunk,
          partial: output,
        });
      }
    }

    const final = await result;
    output.usage = mapQueryResultUsageToPi(final, model);

    if (requestLog) {
      await requestLog.logLlmResponse(workPhase, {
        content: final.content,
        finishReason: final.finishReason,
        usage: final.usage,
        toolCalls: final.toolCalls,
      });
      const cacheStats = getCacheStats(driver);
      if (cacheStats) {
        await requestLog.logCacheStats(workPhase, cacheStats);
      }
    }

    const cleanedText = final.content ?? "";
    const textBlock = getTextBlock(output, textIndex);
    if (textBlock) {
      textBlock.text = cleanedText;
      piStream.push({
        type: "text_end",
        contentIndex: textIndex,
        content: cleanedText,
        partial: output,
      });
    }

    if (final.toolCalls?.length) {
      emitToolCallsFromResult(final.toolCalls, output, piStream);
    }

    const termination = resolveStreamTermination(final, options?.signal);
    output.stopReason = termination.stopReason;

    if (termination.event === "error") {
      const reason = termination.stopReason === "aborted" ? "aborted" : "error";
      if (requestLog) {
        await requestLog.logError(workPhase, reason, { stopReason: termination.stopReason });
      }
      piStream.push({
        type: "error",
        reason,
        error: output,
      });
    } else {
      if (requestLog) {
        await requestLog.logOut("response", {
          stopReason: termination.stopReason,
          usage: output.usage,
        });
      }
      piStream.push({
        type: "done",
        reason: termination.doneReason!,
        message: output,
      });
    }
    piStream.end();
  } catch (error) {
    output.stopReason = isAborted(options?.signal) ? "aborted" : "error";
    output.errorMessage = error instanceof Error ? error.message : String(error);
    if (requestLog) {
      await requestLog.logError(workPhase, output.errorMessage, { stopReason: output.stopReason });
    }
    piStream.push({ type: "error", reason: output.stopReason, error: output });
    piStream.end();
  }
}

export { PHASE3_VIRTUAL_MODEL_ERROR };
