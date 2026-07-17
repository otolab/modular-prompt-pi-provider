import { describe, expect, it } from "vitest";
import type { CompiledPrompt } from "@modular-prompt/core";
import { TestDriver } from "@modular-prompt/driver";
import {
  buildPassthroughRequest,
  runPassthroughWorkflow,
  streamPassthroughWorkflow,
} from "../src/workflow/passthrough.js";
import { runLogicalPassthroughStream } from "../src/workflow/runner.js";

function testPrompt(): CompiledPrompt {
  return {
    instructions: [],
    data: [],
    output: [],
  };
}

describe("passthrough workflow", () => {
  it("streamPassthroughWorkflow は driver.streamQuery を委譲する", async () => {
    const driver = new TestDriver({ responses: ["hello"] });
    const request = buildPassthroughRequest(testPrompt(), { stream: true, maxTokens: 100 });

    const { stream, result } = await streamPassthroughWorkflow({ driver, request });
    const chunks: string[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks.join("")).toBe("hello");
    await expect(result).resolves.toMatchObject({ content: "hello" });
  });

  it("runPassthroughWorkflow は response を返す", async () => {
    const driver = new TestDriver({ responses: ["done"] });
    const request = buildPassthroughRequest(testPrompt(), { maxTokens: 100 });

    const workflowResult = await runPassthroughWorkflow({ driver, request });
    expect(workflowResult.type).toBe("response");
    if (workflowResult.type === "response") {
      expect(workflowResult.text).toBe("done");
    }
  });

  it("runPassthroughWorkflow は tool_calls を返す", async () => {
    const driver = new TestDriver({
      responses: [
        {
          content: "",
          toolCalls: [{ id: "tc1", name: "read", arguments: { path: "a.txt" } }],
          finishReason: "tool_calls",
        },
      ],
    });
    const request = buildPassthroughRequest(testPrompt(), {
      maxTokens: 100,
      tools: [{ name: "read", description: "read", parameters: {} }],
    });

    const workflowResult = await runPassthroughWorkflow({ driver, request });
    expect(workflowResult.type).toBe("tool_calls");
    if (workflowResult.type === "tool_calls") {
      expect(workflowResult.calls[0]?.name).toBe("read");
    }
  });

  it("runLogicalPassthroughStream は論理モデル経由でストリームする", async () => {
    const driver = new TestDriver({ responses: ["logical"] });
    const request = buildPassthroughRequest(testPrompt(), { stream: true, maxTokens: 100 });

    const { stream, result } = await runLogicalPassthroughStream(
      {
        kind: "logical",
        logicalName: "gemma",
        model: {
          logicalName: "gemma",
          provider: "mlx",
          physicalModel: "mlx-community/gemma",
          defaultQueryOptions: { maxTokens: 8192 },
          disabled: false,
          spec: {
            model: "mlx-community/gemma",
            provider: "mlx",
            capabilities: [],
            maxOutputTokens: 8192,
          },
        },
      },
      driver,
      request,
    );

    const chunks: string[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    expect(chunks.join("")).toBe("logical");
    await expect(result).resolves.toMatchObject({ content: "logical" });
  });
});
