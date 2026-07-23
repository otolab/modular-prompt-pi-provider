import { summarizeProcess } from "@modular-prompt/process";
import type { SummarizeWorkflowContext } from "@modular-prompt/process";
import type { CompactInput, CompactResult, CompactRunContext } from "../../types.js";
import { createSummarizeProcessModule } from "./module.js";

export const SUMMARIZE_PROCESS_STRATEGY_ID = "summarize-process";
export const DEFAULT_SUMMARIZE_TARGET_TOKENS = 4096;

export async function runSummarizeProcessStrategy(
  input: CompactInput,
  context: CompactRunContext,
): Promise<CompactResult> {
  if (input.chunks.length === 0) {
    throw new Error("compact input requires at least one chunk");
  }

  const targetTokens = input.targetTokens ?? DEFAULT_SUMMARIZE_TARGET_TOKENS;
  const summarizeContext: SummarizeWorkflowContext = {
    chunks: input.chunks,
    state: input.state ?? { content: "", usage: 0 },
    targetTokens,
  };

  const result = await summarizeProcess(
    context.driver,
    createSummarizeProcessModule(),
    summarizeContext,
    {
      targetTokens,
      enableAnalysis: context.enableAnalysis ?? true,
    },
  );

  const state = result.context.state ?? {
    content: result.output,
    usage: 0,
  };

  return {
    summary: result.output,
    state: {
      content: state.content,
      usage: state.usage,
    },
  };
}
