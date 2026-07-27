/**
 * Pi 公式 tokens.test.ts シナリオ（adapt）
 * @see https://github.com/earendil-works/pi/blob/main/packages/ai/test/tokens.test.ts
 * pi-ai: 0.80.6
 */
import { expect } from "vitest";
import { stream } from "@earendil-works/pi-ai/compat";
import type { Api, AssistantMessage, Context, Model, StreamOptions } from "@earendil-works/pi-ai";
import { PROVIDER_ID } from "../../../../src/constants.js";

type StreamOptionsWithExtras = StreamOptions & Record<string, unknown>;

export async function testTokensOnAbort<TApi extends Api>(
  llm: Model<TApi>,
  options: StreamOptionsWithExtras = {},
): Promise<void> {
  const context: Context = {
    messages: [
      {
        role: "user",
        content: "Write a long poem with 20 stanzas about the beauty of nature.",
        timestamp: Date.now(),
      },
    ],
    systemPrompt: "You are a helpful assistant.",
  };

  const controller = new AbortController();
  const response = stream(llm, context, { ...options, signal: controller.signal });

  let abortFired = false;
  let text = "";
  for await (const event of response) {
    if (!abortFired && (event.type === "text_delta" || event.type === "thinking_delta")) {
      text += event.delta;
      if (text.length >= 1000) {
        abortFired = true;
        controller.abort();
      }
    }
  }

  const msg = await response.result();
  expectModularPromptTokensOnAbort(llm, msg);
}

/** modular-prompt-provider: driver の usage を Pi にマッピングして返す */
export function expectModularPromptTokensOnAbort(llm: Model, msg: AssistantMessage): void {
  expect(msg.stopReason).toBe("aborted");

  if (llm.provider !== PROVIDER_ID) {
    throw new Error(`expectModularPromptTokensOnAbort is for ${PROVIDER_ID} only`);
  }

  expect(msg.usage.input).toBeGreaterThan(0);
  expect(msg.usage.output).toBeGreaterThan(0);
}
