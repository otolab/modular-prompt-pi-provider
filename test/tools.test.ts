import { describe, expect, it } from "vitest";
import { Type } from "typebox";
import type { Tool } from "@earendil-works/pi-ai";
import { piToolsToToolDefinitions } from "../src/adapter/tools.js";

describe("piToolsToToolDefinitions", () => {
  it("maps Pi Tool to driver ToolDefinition", () => {
    const tools: Tool[] = [
      {
        name: "read",
        description: "Read a file",
        parameters: Type.Object({
          path: Type.String(),
        }),
      },
    ];

    expect(piToolsToToolDefinitions(tools)).toEqual([
      {
        name: "read",
        description: "Read a file",
        parameters: tools[0]!.parameters as Record<string, unknown>,
      },
    ]);
  });

  it("returns empty array for no tools", () => {
    expect(piToolsToToolDefinitions([])).toEqual([]);
  });
});
