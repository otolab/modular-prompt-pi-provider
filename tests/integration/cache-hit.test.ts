import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { CompiledPrompt } from "@modular-prompt/core";
import { AIService } from "@modular-prompt/driver";
import type { Api, Context, Model } from "@earendil-works/pi-ai";
import { API_ID, PROVIDER_ID } from "../../src/constants.js";
import { getCacheStats } from "../../src/driver/cache-stats.js";
import { getDriverForLogicalModel } from "../../src/driver/model-registry.js";
import { closeActiveDriver } from "../../src/driver/pool.js";
import { initApplicationConfig, resetAIService } from "../../src/driver/service.js";
import { streamModularPrompt } from "../../src/stream-simple.js";
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

function buildModelSpec(modelId: string, cacheDir?: string) {
  return {
    model: modelId,
    provider: "mlx" as const,
    capabilities: INTEGRATION_DRIVER_CAPABILITIES,
    maxOutputTokens: 64,
    ...(cacheDir ? { driverOptions: { cacheDir } } : {}),
    defaultOptions: { maxTokens: 32, temperature: 0 },
  };
}

const DRIVER_PROBE_PROMPT: CompiledPrompt = {
  instructions: [
    {
      type: "text",
      content: "You are a concise assistant. Reply with one short English word.",
    },
  ],
  data: [{ type: "text", content: "user: integration-cache-driver-round" }],
  output: [],
};

function hasCacheActivity(
  first: { usage?: { cacheReadTokens?: number; cacheWriteTokens?: number } },
  second: { usage?: { cacheReadTokens?: number; cacheWriteTokens?: number } },
): boolean {
  return (
    (second.usage?.cacheReadTokens ?? 0) > 0 ||
    (first.usage?.cacheWriteTokens ?? 0) > 0
  );
}

function hasPiCacheActivity(
  first: { usage?: { cacheRead?: number; cacheWrite?: number } },
  second: { usage?: { cacheRead?: number; cacheWrite?: number } },
  stats?: ReturnType<typeof getCacheStats>,
): boolean {
  return (
    (second.usage?.cacheRead ?? 0) > 0 ||
    (first.usage?.cacheWrite ?? 0) > 0 ||
    (stats?.incremental ?? 0) > 0 ||
    (stats?.prefillReusedTokens ?? 0) > 0
  );
}

describe.skipIf(!probe.runtimeAvailable)("MLX runtime smoke", () => {
  it("probe が利用モデルを報告する", () => {
    expect(probe.modelId.length).toBeGreaterThan(0);
  });
});

describe.skipIf(!probe.cacheSupported)("MLX KV cache (driver)", () => {
  const modelId = probe.modelId!;
  let cacheDir: string;

  beforeAll(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), "mpp-cache-driver-it-"));
  });

  afterAll(async () => {
    await rm(cacheDir, { recursive: true, force: true });
  });

  it("同一プロンプトの 2 回目で cacheRead または 1 回目で cacheWrite が付く", async () => {
    const spec = buildModelSpec(modelId, cacheDir);
    const service = new AIService({ models: [spec] });
    const driver = await service.createDriver(spec);

    try {
      const q1 = await driver.streamQuery(DRIVER_PROBE_PROMPT, {
        maxTokens: 32,
        cache: true,
      });
      for await (const _ of q1.stream) {
        // consume
      }
      const first = await q1.result;

      const q2 = await driver.streamQuery(DRIVER_PROBE_PROMPT, {
        maxTokens: 32,
        cache: true,
      });
      for await (const _ of q2.stream) {
        // consume
      }
      const second = await q2.result;

      expect(hasCacheActivity(first, second)).toBe(true);
    } finally {
      await driver.close();
    }
  });
});

describe.skipIf(!probe.cacheSupported)("MLX KV cache (Pi stream)", () => {
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
      cache: {
        sweepOnStartup: false,
        sweepBeforeWrite: false,
      },
      providers: {
        mlx: { cacheDir },
      },
      models: [buildModelSpec(modelId)],
    });
  });

  afterEach(async () => {
    await closeActiveDriver();
  });

  afterAll(async () => {
    resetAIService();
    await rm(cacheDir, { recursive: true, force: true });
  });

  it("同一プロンプトの 2 回目で KV キャッシュが効く", async () => {
    const context = cacheableContext("integration-cache-hit-round");
    const streamOptions = {
      sessionId: "integration-cache-session",
      cacheRetention: "short" as const,
    };

    const first = await collectAssistantMessage(
      streamModularPrompt(piModel, context, streamOptions),
    );
    expect(first.stopReason).toBe("stop");

    const second = await collectAssistantMessage(
      streamModularPrompt(piModel, context, streamOptions),
    );
    expect(second.stopReason).toBe("stop");

    const stats = getCacheStats(await getDriverForLogicalModel(modelId));
    expect(
      hasPiCacheActivity(first, second, stats),
      `usage first=${JSON.stringify(first.usage)} second=${JSON.stringify(second.usage)} stats=${JSON.stringify(stats)}`,
    ).toBe(true);
  });

  it("cacheRetention none では cacheRead しない", async () => {
    const context = cacheableContext("integration-cache-disabled-round");
    const streamOptions = { cacheRetention: "none" as const };

    await collectAssistantMessage(
      streamModularPrompt(piModel, context, streamOptions),
    );
    const second = await collectAssistantMessage(
      streamModularPrompt(piModel, context, streamOptions),
    );

    expect(second.usage?.cacheRead ?? 0).toBe(0);
    expect(second.usage?.cacheWrite ?? 0).toBe(0);
  });

  it("metadata.cache read-only は読み取りのみで書き込まない", async () => {
    const context = cacheableContext("integration-read-only-round");
    await collectAssistantMessage(
      streamModularPrompt(piModel, context, {
        sessionId: "integration-read-only",
        cacheRetention: "short",
      }),
    );

    const readOnly = await collectAssistantMessage(
      streamModularPrompt(piModel, context, {
        sessionId: "integration-read-only",
        cacheRetention: "short",
        metadata: { cache: "read-only" },
      }),
    );

    expect(readOnly.usage?.cacheWrite ?? 0).toBe(0);
    const stats = getCacheStats(await getDriverForLogicalModel(modelId));
    expect(
      (readOnly.usage?.cacheRead ?? 0) > 0 || (stats?.incremental ?? 0) > 0,
    ).toBe(true);
  });
});
