import { convertToLlm, serializeConversation } from "@earendil-works/pi-coding-agent";
import type { SessionBeforeCompactEvent } from "@earendil-works/pi-coding-agent";
import type { AIDriver } from "@modular-prompt/driver";
import { runCompact } from "../runner.js";
import type { CompactWorkflowLogger } from "../logging.js";
import type { CompactChunk, CompactInput } from "../types.js";

type CompactionPreparation = SessionBeforeCompactEvent["preparation"];

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface PreparationToCompactInputOptions {
  targetTokens?: number;
  customInstructions?: string;
}

/** Pi `CompactionPreparation` を汎用 `CompactInput` に変換する */
export function preparationToCompactInput(
  preparation: CompactionPreparation,
  options: PreparationToCompactInputOptions = {},
): CompactInput | undefined {
  const messages = [
    ...preparation.messagesToSummarize,
    ...preparation.turnPrefixMessages,
  ];
  if (messages.length === 0) {
    return undefined;
  }

  const conversationText = serializeConversation(convertToLlm(messages));
  const chunks: CompactChunk[] = [
    {
      content: conversationText,
      partOf: "session",
      usage: estimateTokens(conversationText),
    },
  ];

  const customInstructions = options.customInstructions?.trim();
  if (customInstructions) {
    chunks.push({
      content: customInstructions,
      partOf: "custom-instructions",
      usage: estimateTokens(customInstructions),
    });
  }

  const input: CompactInput = {
    chunks,
    targetTokens: options.targetTokens,
  };

  if (preparation.previousSummary) {
    input.state = {
      content: preparation.previousSummary,
      usage: estimateTokens(preparation.previousSummary),
    };
  }

  return input;
}

export interface RunPiCompactOptions {
  strategyId: string;
  preparation: CompactionPreparation;
  compactionModel: string;
  customInstructions?: string;
  targetTokens?: number;
  tokenLimit?: number;
  maxChunk?: number;
  signal?: AbortSignal;
  getDriver: (logicalName: string) => Promise<AIDriver>;
  logger?: CompactWorkflowLogger;
}

export interface RunPiCompactResult {
  summary: string;
  firstKeptEntryId: string;
  tokensBefore: number;
}

/** Pi compact イベント向けに strategy を実行し、Pi へ返す結果を組み立てる */
export async function runPiCompact(
  options: RunPiCompactOptions,
): Promise<RunPiCompactResult | undefined> {
  if (options.signal?.aborted) {
    return undefined;
  }

  const input = preparationToCompactInput(options.preparation, {
    targetTokens: options.targetTokens,
    customInstructions: options.customInstructions,
  });
  if (!input) {
    return undefined;
  }

  const driver = await options.getDriver(options.compactionModel);
  const result = await runCompact(options.strategyId, input, {
    driver,
    signal: options.signal,
    tokenLimit: options.tokenLimit,
    maxChunk: options.maxChunk,
    logger: options.logger,
  });

  if (options.signal?.aborted || !result.summary.trim()) {
    return undefined;
  }

  return {
    summary: result.summary,
    firstKeptEntryId: options.preparation.firstKeptEntryId,
    tokensBefore: options.preparation.tokensBefore,
  };
}
