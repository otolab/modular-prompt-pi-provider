import { resolveCompactStrategy } from "./registry.js";
import type { CompactInput, CompactResult, CompactRunContext } from "./types.js";

/** strategyId に応じて圧縮を実行する（root は委譲のみ） */
export async function runCompact(
  strategyId: string,
  input: CompactInput,
  context: CompactRunContext,
): Promise<CompactResult> {
  const strategy = resolveCompactStrategy(strategyId);
  const logger = context.logger;

  await logger?.logStart(strategyId, input);
  try {
    const result = await strategy.run(input, context);
    await logger?.logResult(result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logger?.logError(message, error);
    throw error;
  }
}
