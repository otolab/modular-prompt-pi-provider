import { describe, expect, it } from "vitest";
import type { Api, AssistantMessage, Model } from "@earendil-works/pi-ai";
import { API_ID, PROVIDER_ID } from "../src/constants.js";
import {
  isMlxOverflowErrorMessage,
  normalizeOverflowErrorMessage,
  rewriteAssistantOverflowMessage,
} from "../src/hooks/overflow-rewrite.js";

const piModel = {
  id: "test-model",
  provider: PROVIDER_ID,
  api: API_ID,
} as Model<Api>;

function assistantMessage(
  overrides: Partial<AssistantMessage> = {},
): AssistantMessage {
  return {
    role: "assistant",
    content: [],
    api: API_ID,
    provider: PROVIDER_ID,
    model: "test-model",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "error",
    errorMessage: "maximum sequence length exceeded",
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("isMlxOverflowErrorMessage", () => {
  it("MLX 固有の overflow 文字列を検出する", () => {
    expect(isMlxOverflowErrorMessage("maximum sequence length exceeded")).toBe(true);
    expect(isMlxOverflowErrorMessage("context length exceeds model limit")).toBe(true);
    expect(isMlxOverflowErrorMessage("prompt too long for KV cache")).toBe(true);
  });

  it("既に context_length_exceeded なら対象外", () => {
    expect(
      isMlxOverflowErrorMessage("context_length_exceeded: already normalized"),
    ).toBe(false);
  });

  it("レートリミット系は誤検知しない", () => {
    expect(isMlxOverflowErrorMessage("rate limit exceeded")).toBe(false);
    expect(isMlxOverflowErrorMessage("Too many requests")).toBe(false);
    expect(
      isMlxOverflowErrorMessage(
        "ThrottlingException: Too many tokens, please wait before trying again.",
      ),
    ).toBe(false);
  });

  it("無関係なエラーは対象外", () => {
    expect(isMlxOverflowErrorMessage("connection reset")).toBe(false);
  });
});

describe("rewriteAssistantOverflowMessage", () => {
  it("本プロバイダの assistant overflow をリライトする", () => {
    const message = assistantMessage();
    const rewritten = rewriteAssistantOverflowMessage(message, piModel);

    expect(rewritten?.errorMessage).toBe(
      normalizeOverflowErrorMessage("maximum sequence length exceeded"),
    );
  });

  it("既に context_length_exceeded ならリライトしない", () => {
    const message = assistantMessage({
      errorMessage: "context_length_exceeded: done",
    });
    expect(rewriteAssistantOverflowMessage(message, piModel)).toBeUndefined();
  });

  it("他プロバイダのメッセージは触らない", () => {
    const message = assistantMessage({
      provider: "openai",
      errorMessage: "maximum sequence length exceeded",
    });
    const otherModel = { ...piModel, provider: "openai" } as Model<Api>;
    expect(rewriteAssistantOverflowMessage(message, otherModel)).toBeUndefined();
    expect(rewriteAssistantOverflowMessage(message, undefined)).toBeUndefined();
  });

  it("stopReason が error でなければ触らない", () => {
    const message = assistantMessage({
      stopReason: "stop",
      errorMessage: "maximum sequence length exceeded",
    });
    expect(rewriteAssistantOverflowMessage(message, piModel)).toBeUndefined();
  });

  it("ctx.model.provider で本プロバイダを判定できる", () => {
    const message = assistantMessage({
      provider: "other",
      errorMessage: "context length exceeds maximum",
    });
    const rewritten = rewriteAssistantOverflowMessage(message, piModel);
    expect(rewritten?.errorMessage).toContain("context_length_exceeded:");
  });
});
