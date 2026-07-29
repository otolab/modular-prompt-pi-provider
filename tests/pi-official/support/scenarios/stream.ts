/**
 * Pi 公式 stream.test.ts シナリオ（adapt）
 * @see https://github.com/earendil-works/pi/blob/main/packages/ai/test/stream.test.ts
 * pi-ai: 0.80.6
 */
import { Type } from "typebox";
import { expect } from "vitest";
import { complete, stream } from "@earendil-works/pi-ai/compat";
import type { Context, Model, StreamOptions, Tool } from "@earendil-works/pi-ai";

type StreamOptionsWithExtras = StreamOptions & Record<string, unknown>;

const calculatorSchema = Type.Object({
  a: Type.Number({ description: "First number" }),
  b: Type.Number({ description: "Second number" }),
  operation: Type.String({ description: "add | subtract | multiply | divide" }),
});

const calculatorTool: Tool = {
  name: "math_operation",
  description: "Perform basic arithmetic operations",
  parameters: calculatorSchema,
};

export async function basicTextGeneration(
  model: Model,
  options?: StreamOptionsWithExtras,
): Promise<void> {
  const context: Context = {
    systemPrompt: "You are a helpful assistant. Be concise.",
    messages: [
      {
        role: "user",
        content: "Reply with exactly: 'Hello test successful'",
        timestamp: Date.now(),
      },
    ],
  };
  const response = await complete(model, context, options);

  expect(response.role).toBe("assistant");
  expect(response.content).toBeTruthy();
  expect(response.usage.input + response.usage.cacheRead).toBeGreaterThan(0);
  expect(response.usage.output).toBeGreaterThan(0);
  expect(response.errorMessage).toBeFalsy();
  expect(
    response.content.map((b) => (b.type === "text" ? b.text : "")).join(""),
  ).toContain("Hello test successful");

  context.messages.push(response);
  context.messages.push({
    role: "user",
    content: "Now say 'Goodbye test successful'",
    timestamp: Date.now(),
  });

  const secondResponse = await complete(model, context, options);

  expect(secondResponse.role).toBe("assistant");
  expect(secondResponse.content).toBeTruthy();
  expect(secondResponse.usage.input + secondResponse.usage.cacheRead).toBeGreaterThan(0);
  expect(secondResponse.usage.output).toBeGreaterThan(0);
  expect(secondResponse.errorMessage).toBeFalsy();
  expect(
    secondResponse.content.map((b) => (b.type === "text" ? b.text : "")).join(""),
  ).toContain("Goodbye test successful");
}

export async function handleStreaming(
  model: Model,
  options?: StreamOptionsWithExtras,
): Promise<void> {
  let textStarted = false;
  let textChunks = "";
  let textCompleted = false;

  const context: Context = {
    messages: [{ role: "user", content: "Count from 1 to 3", timestamp: Date.now() }],
    systemPrompt: "You are a helpful assistant.",
  };

  const s = stream(model, context, options);

  for await (const event of s) {
    if (event.type === "text_start") {
      textStarted = true;
    } else if (event.type === "text_delta") {
      textChunks += event.delta;
    } else if (event.type === "text_end") {
      textCompleted = true;
    }
  }

  const response = await s.result();

  expect(textStarted).toBe(true);
  expect(textChunks.length).toBeGreaterThan(0);
  expect(textCompleted).toBe(true);
  expect(response.content.some((b) => b.type === "text")).toBeTruthy();
}

export async function handleToolCall(
  model: Model,
  options?: StreamOptionsWithExtras,
): Promise<void> {
  const context: Context = {
    systemPrompt: "You are a helpful assistant that uses tools when asked.",
    messages: [
      {
        role: "user",
        content: "Calculate 15 + 27 using the math_operation tool.",
        timestamp: Date.now(),
      },
    ],
    tools: [calculatorTool],
  };

  const s = stream(model, context, options);
  let hasToolStart = false;
  let hasToolDelta = false;
  let hasToolEnd = false;
  let accumulatedToolArgs = "";
  let index = 0;

  for await (const event of s) {
    if (event.type === "toolcall_start") {
      hasToolStart = true;
      const toolCall = event.partial.content[event.contentIndex];
      index = event.contentIndex;
      expect(toolCall.type).toBe("toolCall");
      if (toolCall.type === "toolCall") {
        expect(toolCall.name).toBe("math_operation");
        expect(toolCall.id).toBeTruthy();
      }
    }
    if (event.type === "toolcall_delta") {
      hasToolDelta = true;
      const toolCall = event.partial.content[event.contentIndex];
      expect(event.contentIndex).toBe(index);
      expect(toolCall.type).toBe("toolCall");
      if (toolCall.type === "toolCall") {
        expect(toolCall.name).toBe("math_operation");
        accumulatedToolArgs += event.delta;
        expect(toolCall.arguments).toBeDefined();
        expect(typeof toolCall.arguments).toBe("object");
        expect(toolCall.arguments).not.toBeNull();
      }
    }
    if (event.type === "toolcall_end") {
      hasToolEnd = true;
      const toolCall = event.partial.content[event.contentIndex];
      expect(event.contentIndex).toBe(index);
      expect(toolCall.type).toBe("toolCall");
      if (toolCall.type === "toolCall") {
        expect(toolCall.name).toBe("math_operation");
        JSON.parse(accumulatedToolArgs);
        expect(toolCall.arguments).not.toBeUndefined();
        expect((toolCall.arguments as { a?: number }).a).toBe(15);
        expect((toolCall.arguments as { b?: number }).b).toBe(27);
      }
    }
  }

  expect(hasToolStart).toBe(true);
  expect(hasToolDelta).toBe(true);
  expect(hasToolEnd).toBe(true);

  const response = await s.result();
  expect(response.stopReason).toBe("toolUse");
  expect(response.content.some((b) => b.type === "toolCall")).toBeTruthy();
  const toolCall = response.content.find((b) => b.type === "toolCall");
  if (toolCall && toolCall.type === "toolCall") {
    expect(toolCall.name).toBe("math_operation");
    expect(toolCall.id).toBeTruthy();
  } else {
    throw new Error("No tool call found in response");
  }
}
