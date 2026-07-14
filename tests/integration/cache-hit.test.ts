import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Api, Context, Model } from "@earendil-works/pi-ai";
import { API_ID, PROVIDER_ID } from "../../src/constants.js";
import { closeActiveDriver } from "../../src/driver/pool.js";
import { initApplicationConfig, resetAIService } from "../../src/driver/service.js";
import { streamModularPromptMlx } from "../../src/stream-simple.js";
import { collectAssistantMessage } from "./support/collect-stream.js";
import { INTEGRATION_DRIVER_CAPABILITIES } from "./support/driver-capabilities.js";
import { getMlxProbe } from "./support/get-mlx-probe.js";

const probe = await getMlxProbe();

if (!probe.runtimeAvailable) {
  console.info(`[integration] MLX runtime skipped: ${probe.runtimeReason}`);
}
if (!probe.cacheSupported) {
  const reason = probe.cacheReason ?? probe.runtimeReason ?? "unknown";
  console.info(`[integration] MLX KV cache tests skipped: ${reason}`);
}

describe.skipIf(!probe.runtimeAvailable)("MLX runtime smoke", () => {
  it("probe が利用モデルを報告する", () => {
    expect(probe.modelId.length).toBeGreaterThan(0);
  });
});

describe.skipIf(!probe.cacheSupported)("MLX KV cache", () => {
  const modelId = probe.modelId!;
  let cacheDir: string;

  const piModel = {
    id: modelId,
    name: modelId,
    api: API_ID,
    provider: PROVIDER_ID,
    baseUrl: "local://integration",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    contextWindow: 128_000,
    maxTokens: 64,
  } as Model<Api>;

  function cacheableContext(userText: string): Context {
    return {
      systemPrompt:
        "You are a concise assistant. Answer in one short English word.",
      messages: [{ role: "user", content: userText, timestamp: Date.now() }],
    };
  }

  beforeAll(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), "mpp-cache-it-"));
    initApplicationConfig({
      models: [
        {
          model: modelId,
          provider: "mlx",
          capabilities: INTEGRATION_DRIVER_CAPABILITIES,
          maxOutputTokens: 64,
          driverOptions: { cacheDir },
          defaultOptions: { maxTokens: 32, temperature: 0 },
        },
      ],
    });
  });

  afterEach(async () => {
    await closeActiveDriver();
  });

  afterAll(async () => {
    resetAIService();
    await rm(cacheDir, { recursive: true, force: true });
  });

  it("同一プロンプトの 2 回目で cacheReadTokens が付く", async () => {
    const context = cacheableContext("integration-cache-hit-round");
    const streamOptions = {
      sessionId: "integration-cache-session",
      cacheRetention: "short" as const,
    };

    const first = await collectAssistantMessage(
      streamModularPromptMlx(piModel, context, streamOptions),
    );
    expect(first.stopReason).toBe("stop");

    const second = await collectAssistantMessage(
      streamModularPromptMlx(piModel, context, streamOptions),
    );
    expect(second.stopReason).toBe("stop");
    expect(second.usage?.cacheRead ?? 0).toBeGreaterThan(0);
  });

  it("cacheRetention none では cacheRead しない", async () => {
    const context = cacheableContext("integration-cache-disabled-round");
    const streamOptions = { cacheRetention: "none" as const };

    await collectAssistantMessage(
      streamModularPromptMlx(piModel, context, streamOptions),
    );
    const second = await collectAssistantMessage(
      streamModularPromptMlx(piModel, context, streamOptions),
    );

    expect(second.usage?.cacheRead ?? 0).toBe(0);
    expect(second.usage?.cacheWrite ?? 0).toBe(0);
  });

  it("metadata.cache read-only は読み取りのみで書き込まない", async () => {
    const context = cacheableContext("integration-read-only-round");
    await collectAssistantMessage(
      streamModularPromptMlx(piModel, context, {
        sessionId: "integration-read-only",
        cacheRetention: "short",
      }),
    );

    const readOnly = await collectAssistantMessage(
      streamModularPromptMlx(piModel, context, {
        sessionId: "integration-read-only",
        cacheRetention: "short",
        metadata: { cache: "read-only" },
      }),
    );

    expect(readOnly.usage?.cacheWrite ?? 0).toBe(0);
    expect(readOnly.usage?.cacheRead ?? 0).toBeGreaterThan(0);
  });
});
