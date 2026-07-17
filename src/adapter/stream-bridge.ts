import type {
  Api,
  AssistantMessage,
  AssistantMessageEventStream,
  Context,
  Model,
  SimpleStreamOptions,
} from "@earendil-works/pi-ai";
import type { QueryResult, AIDriver } from "@modular-prompt/driver";
import { isAborted, formatCompletionPrompt } from "@modular-prompt/driver";
import { sweepCacheDirBeforeWrite } from "../cache/runtime.js";
import {
  findModelSpec,
  formatStreamSelectionError,
  modelHasCacheDir,
  resolveStreamSelectionWithSource,
} from "../config.js";
import type { LogicalModelSelection, VirtualModelSelection } from "../config/types.js";
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
import { resolveModelSetLogicalName } from "../config/resolve-model-set.js";
import {
  buildPassthroughRequest,
  runLogicalPassthroughStream,
  runVirtualAgenticWorkflow,
  runVirtualPassthroughStream,
  resolveVirtualPassthroughLogicalName,
} from "../workflow/index.js";
import type { WorkflowResult } from "../workflow/types.js";

type SelectionSource = "model.id" | "processes.default" | "virtualModel";

function workflowResultToQueryResult(result: WorkflowResult): QueryResult {
  if (result.type === "tool_calls") {
    return result.queryResult;
  }
  return result.queryResult;
}

async function emitQueryResultToPi(params: {
  final: QueryResult;
  output: AssistantMessage;
  model: Model<Api>;
  piStream: AssistantMessageEventStream;
  options: SimpleStreamOptions | undefined;
  workPhase: string;
  requestLog: ReturnType<typeof beginRequestLog>;
  driverForCacheStats?: AIDriver;
}): Promise<void> {
  const {
    final,
    output,
    model,
    piStream,
    options,
    workPhase,
    requestLog,
    driverForCacheStats,
  } = params;

  output.usage = mapQueryResultUsageToPi(final, model);

  if (requestLog) {
    await requestLog.logLlmResponse(workPhase, {
      content: final.content,
      finishReason: final.finishReason,
      usage: final.usage,
      toolCalls: final.toolCalls,
    });
    if (driverForCacheStats) {
      const cacheStats = getCacheStats(driverForCacheStats);
      if (cacheStats) {
        await requestLog.logCacheStats(workPhase, cacheStats);
      }
    }
  }

  const cleanedText = final.content ?? "";
  const textIndex = output.content.findIndex((block) => block.type === "text");
  const resolvedTextIndex = textIndex >= 0 ? textIndex : appendTextBlock(output, "");
  const textBlock = getTextBlock(output, resolvedTextIndex);
  if (textBlock) {
    textBlock.text = cleanedText;
    piStream.push({
      type: "text_end",
      contentIndex: resolvedTextIndex,
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
}

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
    const resolved = resolveStreamSelectionWithSource(model.id, resolvedConfig);

    if (!resolved) {
      throw new Error(formatStreamSelectionError(model.id, resolvedConfig));
    }

    const { selection, source: baseSource } = resolved;
    let selectionSource: SelectionSource = baseSource;
    let logicalName: string;
    let defaultQueryOptionsSource: LogicalModelSelection["model"];

    if (selection.kind === "virtual") {
      selectionSource = "virtualModel";
      if (selection.workflow.type === "agentic") {
        await runVirtualAgenticPath({
          model,
          context,
          options,
          output,
          piStream,
          workPhase,
          requestLog,
          resolvedConfig,
          selection,
          selectionSource,
        });
        return;
      }

      logicalName = resolveVirtualPassthroughLogicalName(resolvedConfig, selection);
      defaultQueryOptionsSource = resolvedConfig.logicalModels.get(logicalName)!;
    } else {
      logicalName = selection.logicalName;
      defaultQueryOptionsSource = selection.model;
    }

    const modelSpec = findModelSpec(resolvedConfig, logicalName);
    const hasCacheDir = modelHasCacheDir(resolvedConfig, logicalName);
    setActiveStreamSessionId(options?.sessionId);

    const defaultQueryOptions = pickMlxDriverDefaultOptions(
      defaultQueryOptionsSource.defaultQueryOptions,
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
        selectionSource,
        workflowKey:
          selection.kind === "virtual" ? selection.workflowKey : undefined,
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

    const { stream, result } =
      selection.kind === "virtual"
        ? await runVirtualPassthroughStream(
            resolvedConfig,
            selection,
            driver,
            workflowRequest,
          )
        : await runLogicalPassthroughStream(
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
    await emitQueryResultToPi({
      final,
      output,
      model,
      piStream,
      options,
      workPhase,
      requestLog,
      driverForCacheStats: driver,
    });
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

async function runVirtualAgenticPath(params: {
  model: Model<Api>;
  context: Context;
  options: SimpleStreamOptions | undefined;
  output: AssistantMessage;
  piStream: AssistantMessageEventStream;
  workPhase: string;
  requestLog: ReturnType<typeof beginRequestLog>;
  resolvedConfig: ReturnType<typeof getResolvedProviderConfig>;
  selection: VirtualModelSelection;
  selectionSource: SelectionSource;
}): Promise<void> {
  const {
    model,
    context,
    options,
    output,
    piStream,
    workPhase,
    requestLog,
    resolvedConfig,
    selection,
    selectionSource,
  } = params;

  const logicalName = resolveModelSetLogicalName(
    resolvedConfig,
    selection.workflow.modelSet!,
    "default",
  );
  const modelSpec = findModelSpec(resolvedConfig, logicalName);
  const hasCacheDir = modelHasCacheDir(resolvedConfig, logicalName);
  setActiveStreamSessionId(options?.sessionId);

  const defaultQueryOptions = pickMlxDriverDefaultOptions(
    resolvedConfig.logicalModels.get(logicalName)!.defaultQueryOptions,
  );
  const piQueryOpts = piOptionsToQueryOptions(options, model, hasCacheDir);
  const queryOpts = mergeQueryOptions(
    {
      stream: false,
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
      selectionSource,
      workflowKey: selection.workflowKey,
      workflowType: selection.workflow.type,
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
      workflow: selection.workflowKey,
    });
  }

  const prompt = piContextToCompiledPrompt(context);
  const workflowRequest = buildPassthroughRequest(prompt, queryOpts);

  if (requestLog) {
    await requestLog.logPrompt(workPhase, formatCompletionPrompt(prompt));
  }

  const workflowResult = await runVirtualAgenticWorkflow(
    resolvedConfig,
    selection,
    workflowRequest,
  );

  const text =
    workflowResult.type === "response"
      ? workflowResult.text
      : workflowResult.text ?? "";
  const textIndex = appendTextBlock(output, "");
  piStream.push({ type: "text_start", contentIndex: textIndex, partial: output });

  const final = workflowResultToQueryResult(workflowResult);
  final.content = text;
  await emitQueryResultToPi({
    final,
    output,
    model,
    piStream,
    options,
    workPhase,
    requestLog,
  });
}
