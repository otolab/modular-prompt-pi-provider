import type { Context } from "@earendil-works/pi-ai";
import type { CompiledPrompt } from "@modular-prompt/core";
import { piMessagesToElements } from "./message-mapper.js";

export function piContextToCompiledPrompt(context: Context): CompiledPrompt {
  return {
    instructions: context.systemPrompt
      ? [{ type: "text", content: context.systemPrompt }]
      : [],
    data: piMessagesToElements(context.messages),
    output: [],
  };
}
