/**
 * Pi 公式 context-overflow.test.ts シナリオ（adapt）
 * @see https://github.com/earendil-works/pi/blob/main/packages/ai/test/context-overflow.test.ts
 * pi-ai: 0.80.6
 */
import { expect } from "vitest";
import { complete } from "@earendil-works/pi-ai/compat";
import { isContextOverflow } from "@earendil-works/pi-ai";
import type { AssistantMessage, Context, Model } from "@earendil-works/pi-ai";
import { rewriteAssistantOverflowMessage } from "../../../../src/hooks/overflow-rewrite.js";

const LOREM_IPSUM = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. `;

/** 公式と同じく contextWindow を超える入力を生成する */
export function generateOverflowContent(contextWindow: number): string {
  const targetTokens = contextWindow + 10_000;
  const targetChars = targetTokens * 4 * 1.5;
  const repetitions = Math.ceil(targetChars / LOREM_IPSUM.length);
  return LOREM_IPSUM.repeat(repetitions);
}

export async function testContextOverflow(model: Model): Promise<AssistantMessage> {
  const overflowContent = generateOverflowContent(model.contextWindow);

  const context: Context = {
    systemPrompt: "You are a helpful assistant.",
    messages: [
      {
        role: "user",
        content: overflowContent,
        timestamp: Date.now(),
      },
    ],
  };

  return complete(model, context);
}

/**
 * MLX 生エラーは Pi の isContextOverflow に無い場合がある。
 * 本拡張の overflow リライト（#23）適用後に検出可能であることを確認する。
 */
export function assertOverflowDetectableAfterRewrite(
  message: AssistantMessage,
  model: Model,
): void {
  expect(message.stopReason).toBe("error");
  expect(message.errorMessage).toBeTruthy();

  const rewritten = rewriteAssistantOverflowMessage(message, model) ?? message;
  expect(isContextOverflow(rewritten, model.contextWindow)).toBe(true);
}
