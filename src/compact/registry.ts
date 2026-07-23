import type { CompactStrategy } from "./strategy.js";
import { summarizeProcessStrategy } from "./strategies/summarize-process/index.js";
import { streamSummarizeStrategy } from "./strategies/stream-summarize/index.js";

const strategies = new Map<string, CompactStrategy>([
  [streamSummarizeStrategy.id, streamSummarizeStrategy],
  [summarizeProcessStrategy.id, summarizeProcessStrategy],
]);

export function registerCompactStrategy(strategy: CompactStrategy): void {
  strategies.set(strategy.id, strategy);
}

export function resolveCompactStrategy(strategyId: string): CompactStrategy {
  const strategy = strategies.get(strategyId);
  if (!strategy) {
    const available = [...strategies.keys()].join(", ") || "(none)";
    throw new Error(
      `Unknown compact strategy "${strategyId}". Available: ${available}`,
    );
  }
  return strategy;
}

export function listCompactStrategyIds(): string[] {
  return [...strategies.keys()];
}
