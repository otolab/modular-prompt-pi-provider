import type { Tool } from "@earendil-works/pi-ai";
import type { ToolDefinition } from "@modular-prompt/driver";

/** Pi `Context.tools` → driver `QueryOptions.tools` */
export function piToolsToToolDefinitions(tools: Tool[]): ToolDefinition[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters as Record<string, unknown>,
  }));
}
