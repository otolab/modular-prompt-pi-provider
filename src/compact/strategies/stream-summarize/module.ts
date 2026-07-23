import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PromptModule } from "@modular-prompt/core";
import type { StreamProcessingContext } from "@modular-prompt/process";

let cachedProcedure: string | undefined;

export function loadStreamSummarizeProcedure(): string {
  if (!cachedProcedure) {
    const dir = dirname(fileURLToPath(import.meta.url));
    cachedProcedure = readFileSync(join(dir, "procedure.md"), "utf-8");
  }
  return cachedProcedure;
}

/** procedure.md を methodology に載せたユーザ module */
export function createStreamSummarizeModule(
  procedure = loadStreamSummarizeProcedure(),
): PromptModule<StreamProcessingContext> {
  return {
    objective: [
      "Compress a coding-agent session log into a concise summary for later turns.",
    ],
    methodology: [
      "Follow the compression procedure documented below.",
      procedure,
    ],
    guidelines: [
      "- Output only the Next State content (no meta commentary)",
      "- Preserve file paths and technical terms accurately",
      "- Write in the same language as the source chunks when possible",
    ],
  };
}
