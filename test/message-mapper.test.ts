import { describe, expect, it } from "vitest";
import { piMessageToElements } from "../src/adapter/message-mapper.js";

describe("piMessageToElements", () => {
  it("maps user string message", () => {
    expect(
      piMessageToElements({
        role: "user",
        content: "hello",
        timestamp: 1,
      }),
    ).toEqual([{ type: "message", role: "user", content: "hello" }]);
  });

  it("maps assistant text", () => {
    expect(
      piMessageToElements({
        role: "assistant",
        content: [{ type: "text", text: "hi" }],
        api: "modular-prompt-provider",
        provider: "modular-prompt-provider",
        model: "m",
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        stopReason: "stop",
        timestamp: 1,
      }),
    ).toEqual([{ type: "message", role: "assistant", content: "hi" }]);
  });

  it("maps tool result with error kind", () => {
    expect(
      piMessageToElements({
        role: "toolResult",
        toolCallId: "tc1",
        toolName: "read",
        content: [{ type: "text", text: "failed" }],
        isError: true,
        timestamp: 1,
      }),
    ).toEqual([
      {
        type: "message",
        role: "tool",
        toolCallId: "tc1",
        name: "read",
        kind: "error",
        value: "failed",
      },
    ]);
  });
});
