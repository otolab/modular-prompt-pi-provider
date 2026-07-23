import { resolveCompactStrategy } from "./registry.js";
import type { CompactInput, CompactResult, CompactRunContext } from "./types.js";

/** strategyId に応じて圧縮を実行する（root は委譲のみ） */
export async function runCompact(
  strategyId: string,
  input: CompactInput,
  context: CompactRunContext,
): Promise<CompactResult> {
  const strategy = resolveCompactStrategy(strategyId);
  return strategy.run(input, context);
}
