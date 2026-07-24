import { afterAll, afterEach, describe, expect, it } from "vitest";
import type { Context } from "@earendil-works/pi-ai";
import { closeActiveDriver } from "../../src/driver/pool.js";
import { initApplicationConfig, resetAIService } from "../../src/driver/service.js";
import { streamModularPrompt } from "../../src/stream-simple.js";
import {
  buildPassthroughConfig,
  buildVirtualAgenticConfig,
  buildVirtualPassthroughConfig,
} from "./support/build-integration-config.js";
import { collectAssistantMessage } from "./support/collect-stream.js";
import { getMlxProbe } from "./support/get-mlx-probe.js";
import { buildPiModel } from "./support/pi-model.js";

const probe = await getMlxProbe();

if (!probe.runtimeAvailable) {
  console.info(`[integration] MLX workflow tests skipped: ${probe.runtimeReason}`);
}

function chatContext(userText: string): Context {
  return {
    systemPrompt:
      "You are a concise assistant. Reply in one short English sentence.",
    messages: [{ role: "user", content: userText, timestamp: Date.now() }],
  };
}

function expectSuccessfulAssistantMessage(
  message: Awaited<ReturnType<typeof collectAssistantMessage>>,
): void {
  expect(message.stopReason).not.toBe("error");
  expect(message.errorMessage).toBeUndefined();
  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();
  expect(text.length).toBeGreaterThan(0);
}

describe.skipIf(!probe.runtimeAvailable)("MLX workflow stream (#56)", () => {
  const modelId = probe.modelId!;

  afterEach(async () => {
    await closeActiveDriver();
    resetAIService();
  });

  afterAll(() => {
    resetAIService();
  });

  it("論理モデル passthrough で Pi stream が完了する", async () => {
    initApplicationConfig(buildPassthroughConfig(modelId));

    const message = await collectAssistantMessage(
      streamModularPrompt(
        buildPiModel(modelId),
        chatContext("integration-passthrough-round"),
      ),
    );

    expectSuccessfulAssistantMessage(message);
  });

  it("virtualModel passthrough で Pi stream が完了する", async () => {
    const virtualModel = "virtual-chat-it";
    initApplicationConfig(buildVirtualPassthroughConfig(modelId, virtualModel));

    const message = await collectAssistantMessage(
      streamModularPrompt(
        buildPiModel(virtualModel),
        chatContext("integration-virtual-passthrough-round"),
      ),
    );

    expectSuccessfulAssistantMessage(message);
  });

  it("virtualModel agentic で応答を返す", async () => {
    const virtualModel = "virtual-agentic-it";
    initApplicationConfig(buildVirtualAgenticConfig(modelId, virtualModel));

    const message = await collectAssistantMessage(
      streamModularPrompt(
        buildPiModel(virtualModel),
        chatContext("integration-virtual-agentic-round"),
      ),
    );

    expectSuccessfulAssistantMessage(message);
  });
});
