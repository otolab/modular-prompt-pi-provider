import { describe, expect, it, vi } from "vitest";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { emitToolCallsFromResult } from "../src/adapter/toolcall-emitter.js";
import { createInitialAssistantMessage } from "../src/adapter/message-mapper.js";

describe("emitToolCallsFromResult", () => {
  it("emits toolcall_start, delta, end per call", () => {
    const output = createInitialAssistantMessage({
      api: "modular-prompt-provider",
      provider: "modular-prompt-provider",
      id: "test-model",
    });
    output.content.push({ type: "text", text: "" });

    const events: unknown[] = [];
    const piStream = { push: vi.fn((event) => events.push(event)) };

    emitToolCallsFromResult(
      [{ id: "tc1", name: "read", arguments: { path: "/tmp/a.txt" } }],
      output,
      piStream as never,
    );

    expect(events).toEqual([
      { type: "toolcall_start", contentIndex: 1, partial: output },
      {
        type: "toolcall_delta",
        contentIndex: 1,
        delta: JSON.stringify({ path: "/tmp/a.txt" }),
        partial: output,
      },
      {
        type: "toolcall_end",
        contentIndex: 1,
        toolCall: {
          type: "toolCall",
          id: "tc1",
          name: "read",
          arguments: { path: "/tmp/a.txt" },
        },
        partial: output,
      },
    ]);

    const toolBlock = output.content[1];
    expect(toolBlock).toEqual({
      type: "toolCall",
      id: "tc1",
      name: "read",
      arguments: { path: "/tmp/a.txt" },
    });
  });

  it("emits multiple tool calls with incrementing contentIndex", () => {
    const output: AssistantMessage = createInitialAssistantMessage({
      api: "x",
      provider: "x",
      id: "m",
    });

    const types: string[] = [];
    const piStream = {
      push: vi.fn((event: { type: string; contentIndex?: number }) => {
        types.push(`${event.type}:${event.contentIndex}`);
      }),
    };

    emitToolCallsFromResult(
      [
        { id: "a", name: "read", arguments: {} },
        { id: "b", name: "write", arguments: { path: "b" } },
      ],
      output,
      piStream as never,
    );

    expect(types).toEqual([
      "toolcall_start:0",
      "toolcall_delta:0",
      "toolcall_end:0",
      "toolcall_start:1",
      "toolcall_delta:1",
      "toolcall_end:1",
    ]);
  });
});
