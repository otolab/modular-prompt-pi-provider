import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PromptModule } from "@modular-prompt/core";
import type { SummarizeWorkflowContext } from "@modular-prompt/process";

let cachedProcedure: string | undefined;

export function loadSummarizeProcessProcedure(): string {
  if (!cachedProcedure) {
    const dir = dirname(fileURLToPath(import.meta.url));
    cachedProcedure = readFileSync(join(dir, "procedure.md"), "utf-8");
  }
  return cachedProcedure;
}

/** procedure.md を methodology に載せたユーザ module */
export function createSummarizeProcessModule(
  procedure = loadSummarizeProcessProcedure(),
): PromptModule<SummarizeWorkflowContext> {
  return {
    objective: [
      "Compress a coding-agent session log using analysis and summarization phases.",
    ],
    methodology: [
      "Follow the compression procedure documented below.",
      procedure,
    ],
    guidelines: [
      "- Output only the summary body (no meta commentary)",
      "- Preserve file paths and technical terms accurately",
      "- Match the source language when possible",
    ],
  };
}
