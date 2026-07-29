/**
 * Pi 公式 tool-call-without-result.test.ts シナリオ（adapt）
 * @see https://github.com/earendil-works/pi/blob/main/packages/ai/test/tool-call-without-result.test.ts
 * pi-ai: 0.80.6
 */
import { Type } from "typebox";
import { expect } from "vitest";
import { complete } from "@earendil-works/pi-ai/compat";
import type { Api, Context, Model, StreamOptions, Tool } from "@earendil-works/pi-ai";

type StreamOptionsWithExtras = StreamOptions & Record<string, unknown>;

const calculateSchema = Type.Object({
  expression: Type.String({ description: "The mathematical expression to evaluate" }),
});

const calculateTool: Tool = {
  name: "calculate",
  description: "Evaluate mathematical expressions",
  parameters: calculateSchema,
};

export async function testToolCallWithoutResult<TApi extends Api>(
  model: Model<TApi>,
  options: StreamOptionsWithExtras = {},
): Promise<void> {
  const context: Context = {
    systemPrompt:
      "You are a helpful assistant. Use the calculate tool when asked to perform calculations.",
    messages: [],
    tools: [calculateTool],
  };

  context.messages.push({
    role: "user",
    content: "Please calculate 25 * 18 using the calculate tool.",
    timestamp: Date.now(),
  });

  const firstResponse = await complete(model, context, options);
  context.messages.push(firstResponse);

  const hasToolCall = firstResponse.content.some((block) => block.type === "toolCall");
  expect(hasToolCall).toBe(true);
  if (!hasToolCall) {
    throw new Error("Expected assistant to make a tool call, but none was found");
  }

  context.messages.push({
    role: "user",
    content: "Never mind, just tell me what is 2+2?",
    timestamp: Date.now(),
  });

  const secondResponse = await complete(model, context, options);

  expect(secondResponse.stopReason).not.toBe("error");
  expect(secondResponse.content.length).toBeGreaterThan(0);

  const textContent = secondResponse.content
    .filter((block) => block.type === "text")
    .map((block) => (block.type === "text" ? block.text : ""))
    .join(" ");
  const toolCalls = secondResponse.content.filter((block) => block.type === "toolCall").length;

  expect(["stop", "toolUse"]).toContain(secondResponse.stopReason);
  if (secondResponse.stopReason === "stop") {
    expect(textContent.length).toBeGreaterThan(0);
  } else {
    expect(toolCalls).toBeGreaterThan(0);
  }
}
