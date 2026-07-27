/**
 * Pi 公式 abort.test.ts シナリオ（adapt）
 * @see https://github.com/earendil-works/pi/blob/main/packages/ai/test/abort.test.ts
 * pi-ai: 0.80.6
 */
import { expect } from "vitest";
import { complete, stream } from "@earendil-works/pi-ai/compat";
import type { Api, Context, Model, StreamOptions } from "@earendil-works/pi-ai";

type StreamOptionsWithExtras = StreamOptions & Record<string, unknown>;

export async function testAbortSignal<TApi extends Api>(
  llm: Model<TApi>,
  options: StreamOptionsWithExtras = {},
): Promise<void> {
  const context: Context = {
    messages: [
      {
        role: "user",
        content: "What is 15 + 27? Think step by step. Then list 50 first names.",
        timestamp: Date.now(),
      },
    ],
    systemPrompt: "You are a helpful assistant.",
  };

  let abortFired = false;
  let text = "";
  const controller = new AbortController();
  const response = stream(llm, context, { ...options, signal: controller.signal });
  for await (const event of response) {
    if (abortFired) return;
    if (event.type === "text_delta" || event.type === "thinking_delta") {
      text += event.delta;
    }
    if (text.length >= 50) {
      controller.abort();
      abortFired = true;
    }
  }
  const msg = await response.result();

  expect(msg.stopReason).toBe("aborted");
  expect(msg.content.length).toBeGreaterThan(0);

  context.messages.push(msg);
  context.messages.push({
    role: "user",
    content: "Please continue, but only generate 5 names.",
    timestamp: Date.now(),
  });

  const followUp = await complete(llm, context, options);
  expect(followUp.stopReason).toBe("stop");
  expect(followUp.content.length).toBeGreaterThan(0);
}

export async function testImmediateAbort<TApi extends Api>(
  llm: Model<TApi>,
  options: StreamOptionsWithExtras = {},
): Promise<void> {
  const controller = new AbortController();
  controller.abort();

  const context: Context = {
    messages: [{ role: "user", content: "Hello", timestamp: Date.now() }],
  };

  const response = await complete(llm, context, { ...options, signal: controller.signal });
  expect(response.stopReason).toBe("aborted");
}

export async function testAbortThenNewMessage<TApi extends Api>(
  llm: Model<TApi>,
  options: StreamOptionsWithExtras = {},
): Promise<void> {
  const controller = new AbortController();
  controller.abort();

  const context: Context = {
    messages: [{ role: "user", content: "Hello, how are you?", timestamp: Date.now() }],
  };

  const abortedResponse = await complete(llm, context, {
    ...options,
    signal: controller.signal,
  });
  expect(abortedResponse.stopReason).toBe("aborted");
  expect(abortedResponse.content.length).toBe(0);

  context.messages.push(abortedResponse);
  context.messages.push({
    role: "user",
    content: "What is 2 + 2?",
    timestamp: Date.now(),
  });

  const followUp = await complete(llm, context, options);
  expect(followUp.stopReason).toBe("stop");
  expect(followUp.content.length).toBeGreaterThan(0);
}
