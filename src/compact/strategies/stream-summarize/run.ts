import { streamProcess } from "@modular-prompt/process";
import type { StreamProcessingContext } from "@modular-prompt/process";
import type { CompactInput, CompactResult, CompactRunContext } from "../../types.js";
import { createStreamSummarizeModule } from "./module.js";

export const STREAM_SUMMARIZE_STRATEGY_ID = "stream-summarize";

export async function runStreamSummarizeStrategy(
  input: CompactInput,
  context: CompactRunContext,
): Promise<CompactResult> {
  if (input.chunks.length === 0) {
    throw new Error("compact input requires at least one chunk");
  }

  const processContext: StreamProcessingContext = {
    chunks: input.chunks,
    state: input.state ?? { content: "", usage: 0 },
    targetTokens: input.targetTokens,
  };

  const result = await streamProcess(
    context.driver,
    createStreamSummarizeModule(),
    processContext,
    {
      tokenLimit: context.tokenLimit,
      maxChunk: context.maxChunk,
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
