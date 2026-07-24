import type { Api, AssistantMessage, Model } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { PROVIDER_ID } from "../constants.js";

export const CONTEXT_LENGTH_EXCEEDED_PREFIX = "context_length_exceeded";

/**
 * MLX / llama.cpp 由来のコンテキスト超過エラー。
 * Pi 既知パターンに無い文字列のみ（既に Pi が検知するものはリライト不要）。
 */
export const MLX_OVERFLOW_PATTERNS: readonly RegExp[] = [
  /maximum sequence length/i,
  /context length exceeds/i,
  /context.*exceed/i,
  /exceeds.*context/i,
  /prompt too long/i,
  /greater than the context length/i,
];

/**
 * 誤検知防止: レートリミット・一時障害は compact トリガしない。
 * @see @earendil-works/pi-ai overflow.ts NON_OVERFLOW_PATTERNS
 */
export const MLX_NON_OVERFLOW_PATTERNS: readonly RegExp[] = [
  /^(Throttling error|Service unavailable):/i,
  /rate limit/i,
  /too many requests/i,
  /throttl/i,
  /please wait before trying again/i,
];

export function isMlxOverflowErrorMessage(errorMessage: string): boolean {
  if (errorMessage.includes(CONTEXT_LENGTH_EXCEEDED_PREFIX)) {
    return false;
  }
  if (MLX_NON_OVERFLOW_PATTERNS.some((pattern) => pattern.test(errorMessage))) {
    return false;
  }
  return MLX_OVERFLOW_PATTERNS.some((pattern) => pattern.test(errorMessage));
}

export function normalizeOverflowErrorMessage(errorMessage: string): string {
  return `${CONTEXT_LENGTH_EXCEEDED_PREFIX}: ${errorMessage}`;
}

export function isModularPromptProvider(
  messageProvider: string | undefined,
  ctxModel: Model<Api> | undefined,
): boolean {
  return messageProvider === PROVIDER_ID || ctxModel?.provider === PROVIDER_ID;
}

/** assistant の overflow エラーを Pi 既知形式にリライトする。対象外なら undefined。 */
export function rewriteAssistantOverflowMessage(
  message: AssistantMessage,
  ctxModel: Model<Api> | undefined,
): AssistantMessage | undefined {
  if (message.role !== "assistant") {
    return undefined;
  }
  if (message.stopReason !== "error") {
    return undefined;
  }
  if (!isModularPromptProvider(message.provider, ctxModel)) {
    return undefined;
  }

  const errorMessage = message.errorMessage ?? "";
  if (!errorMessage || !isMlxOverflowErrorMessage(errorMessage)) {
    return undefined;
  }

  return {
    ...message,
    errorMessage: normalizeOverflowErrorMessage(errorMessage),
  };
}

export function registerOverflowRewriteHooks(pi: ExtensionAPI): void {
  pi.on("message_end", (event, ctx) => {
    const message = event.message;
    if (message.role !== "assistant") {
      return;
    }
    const rewritten = rewriteAssistantOverflowMessage(message, ctx.model);
    if (!rewritten) {
      return;
    }
    return { message: rewritten };
  });
}
