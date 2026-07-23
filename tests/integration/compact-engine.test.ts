import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { AIService } from "@modular-prompt/driver";
import { listCompactStrategyIds, runCompact } from "../../src/compact/index.js";
import { closeActiveDriver } from "../../src/driver/pool.js";
import { initApplicationConfig, resetAIService } from "../../src/driver/service.js";
import { INTEGRATION_DRIVER_CAPABILITIES } from "./support/driver-capabilities.js";
import { getMlxProbe } from "./support/get-mlx-probe.js";

const probe = await getMlxProbe();

if (!probe.runtimeAvailable) {
  console.info(`[integration] MLX compact tests skipped: ${probe.runtimeReason}`);
}

const COMPACT_CHUNKS = [
  {
    content:
      "user: Add compact mechanism\nassistant: Implemented src/compact with stream-summarize strategy.\nuser: Wire Pi hook\nassistant: Added session_before_compact handler.",
    partOf: "session",
    usage: 60,
  },
];

const INTEGRATION_STRATEGIES = ["stream-summarize", "summarize-process"] as const;

describe.skipIf(!probe.runtimeAvailable)("MLX compact engine", () => {
  const modelId = probe.modelId!;
  let cacheDir: string;

  beforeAll(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), "mpp-compact-it-"));
    initApplicationConfig({
      models: [
        {
          model: modelId,
          provider: "mlx",
          capabilities: INTEGRATION_DRIVER_CAPABILITIES,
          maxOutputTokens: 256,
          driverOptions: { cacheDir },
          defaultOptions: { maxTokens: 128, temperature: 0 },
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

  for (const strategyId of INTEGRATION_STRATEGIES) {
    it(`${strategyId} で要約を生成する`, async () => {
      expect(listCompactStrategyIds()).toContain(strategyId);

      const spec = {
        model: modelId,
        provider: "mlx" as const,
        capabilities: INTEGRATION_DRIVER_CAPABILITIES,
        maxOutputTokens: 256,
        driverOptions: { cacheDir },
        defaultOptions: { maxTokens: 128, temperature: 0 },
      };
      const service = new AIService({ models: [spec] });
      const driver = await service.createDriver(spec);

      try {
        const result = await runCompact(
          strategyId,
          { chunks: COMPACT_CHUNKS, targetTokens: 256 },
          {
            driver,
            enableAnalysis: strategyId === "summarize-process" ? false : undefined,
          },
        );

        expect(result.summary.trim().length).toBeGreaterThan(20);
        expect(result.state.content.length).toBeGreaterThan(0);
      } finally {
        await driver.close();
      }
    });
  }
});
