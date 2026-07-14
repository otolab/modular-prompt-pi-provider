import type {
  Api,
  AssistantMessageEventStream,
  Context,
  Model,
  SimpleStreamOptions,
} from "@earendil-works/pi-ai";
import { isAborted, formatCompletionPrompt } from "@modular-prompt/driver";
import { sweepCacheDirBeforeWrite } from "../cache/runtime.js";
import { findModelSpec, modelHasCacheDir } from "../config.js";
import { getDriverForModel } from "../driver/pool.js";
import { getApplicationConfig } from "../driver/service.js";
import { setActiveStreamSessionId } from "../cache/session-context.js";
import { beginRequestLog } from "../logging/runtime.js";
import { piContextToCompiledPrompt } from "./context-to-prompt.js";
import { resolveStreamTermination } from "./finish-reason.js";
import {
  appendTextBlock,
  createInitialAssistantMessage,
  getTextBlock,
} from "./message-mapper.js";
import { piOptionsToQueryOptions } from "./options.js";
import { emitToolCallsFromResult } from "./toolcall-emitter.js";
import { piToolsToToolDefinitions } from "./tools.js";
import { mapQueryResultUsageToPi } from "./usage.js";

export async function bridgeDriverStreamToPi(
  model: Model<Api>,
  context: Context,
  options: SimpleStreamOptions | undefined,
  piStream: AssistantMessageEventStream,
): Promise<void> {
  const output = createInitialAssistantMessage(model);
  piStream.push({ type: "start", partial: output });
  const phase = "stream";
  const requestLog = beginRequestLog();

  try {
    if (isAborted(options?.signal)) {
      output.stopReason = "aborted";
      piStream.push({ type: "error", reason: "aborted", error: output });
      piStream.end();
      return;
    }

    const appConfig = getApplicationConfig();
    const modelSpec = findModelSpec(appConfig, model.id);
    const hasCacheDir = modelHasCacheDir(appConfig, model.id);
    setActiveStreamSessionId(options?.sessionId);
    const queryOpts = {
      ...piOptionsToQueryOptions(options, model, hasCacheDir),
      ...(context.tools?.length
        ? {
            tools: piToolsToToolDefinitions(context.tools),
            toolChoice: "auto" as const,
          }
        : {}),
    };

    if (requestLog) {
      await requestLog.logIn(phase, {
        model: model.id,
        sessionId: options?.sessionId,
        messageCount: context.messages.length,
        hasTools: Boolean(context.tools?.length),
        cache: queryOpts.cache,
      });
      await requestLog.logDriverInfo(phase, {
        model: model.id,
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

    const driver = await getDriverForModel(model.id);
    const prompt = piContextToCompiledPrompt(context);

    if (requestLog) {
      await requestLog.logPrompt(phase, formatCompletionPrompt(prompt));
    }

    const { stream, result } = await driver.streamQuery(prompt, queryOpts);

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
      await requestLog.logLlmResponse(phase, {
        content: final.content,
        finishReason: final.finishReason,
        usage: final.usage,
        toolCalls: final.toolCalls,
      });
      if (final.usage?.cacheReadTokens || final.usage?.cacheWriteTokens) {
        await requestLog.logCacheStats(phase, {
          cacheReadTokens: final.usage.cacheReadTokens ?? 0,
          cacheWriteTokens: final.usage.cacheWriteTokens ?? 0,
          promptTokens: final.usage.promptTokens,
          completionTokens: final.usage.completionTokens,
        });
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
        await requestLog.logError(phase, reason, { stopReason: termination.stopReason });
      }
      piStream.push({
        type: "error",
        reason,
        error: output,
      });
    } else {
      if (requestLog) {
        await requestLog.logOut(phase, {
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
      await requestLog.logError(phase, output.errorMessage, { stopReason: output.stopReason });
    }
    piStream.push({ type: "error", reason: output.stopReason, error: output });
    piStream.end();
  }
}
