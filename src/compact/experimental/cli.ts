import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { AIService, TestDriver, type DriverCapability } from "@modular-prompt/driver";
import { INTEGRATION_MLX_MODEL_DEFAULT } from "../../constants.js";
import {
  listCompactStrategyIds,
  runCompact,
  type CompactInput,
} from "../index.js";

const MLX_CAPABILITIES: DriverCapability[] = [
  "streaming",
  "local",
  "multilingual",
  "japanese",
  "chat",
  "tools",
  "reasoning",
  "function-calling",
];

function resolveIntegrationModelId(): string {
  return process.env.INTEGRATION_MLX_MODEL ?? INTEGRATION_MLX_MODEL_DEFAULT;
}

interface CompactFixture {
  chunks: CompactInput["chunks"];
  state?: CompactInput["state"];
  targetTokens?: number;
}

async function loadFixture(path: string): Promise<CompactFixture> {
  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw) as CompactFixture;
}

function printUsage(): void {
  console.log(`Usage: npm run compact:experimental -- [options]

Options:
  --strategy <id>     compact strategy (${listCompactStrategyIds().join(", ")})
  --fixture <path>    JSON fixture with chunks (default: fixtures/compact/sample-session.json)
  --model <id>        MLX physical model (default: INTEGRATION_MLX_MODEL or integration default)
  --driver <mode>     mlx | test (default: mlx)
  --target-tokens <n> override fixture targetTokens
  --no-analysis       summarize-process の分析フェーズを無効化
  --help              show this help

Examples:
  npm run compact:experimental -- --strategy stream-summarize
  npm run compact:experimental -- --strategy summarize-process --driver test
  INTEGRATION_MLX_MODEL=prism-ml/Ternary-Bonsai-1.7B-mlx-2bit npm run compact:experimental
`);
}

async function createMlxDriver(modelId: string) {
  const spec = {
    model: modelId,
    provider: "mlx" as const,
    capabilities: MLX_CAPABILITIES,
    maxOutputTokens: 512,
    defaultOptions: { maxTokens: 256, temperature: 0 },
  };
  const service = new AIService({ models: [spec] });
  return service.createDriver(spec);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      strategy: { type: "string", default: "stream-summarize" },
      fixture: { type: "string", default: "fixtures/compact/sample-session.json" },
      model: { type: "string" },
      driver: { type: "string", default: "mlx" },
      "target-tokens": { type: "string" },
      "no-analysis": { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
    allowPositionals: false,
  });

  if (values.help) {
    printUsage();
    return;
  }

  const strategyId = values.strategy!;
  if (!listCompactStrategyIds().includes(strategyId)) {
    throw new Error(
      `Unknown strategy "${strategyId}". Available: ${listCompactStrategyIds().join(", ")}`,
    );
  }

  const fixture = await loadFixture(values.fixture!);
  const targetTokens = values["target-tokens"]
    ? Number(values["target-tokens"])
    : fixture.targetTokens;

  const driverMode = values.driver ?? "mlx";
  const driver =
    driverMode === "test"
      ? new TestDriver({
          responses: [
            "## Goal\nExperimental compact summary for fixture session.",
          ],
        })
      : await createMlxDriver(values.model ?? resolveIntegrationModelId());

  try {
    const startedAt = Date.now();
    const result = await runCompact(
      strategyId,
      {
        chunks: fixture.chunks,
        state: fixture.state,
        targetTokens,
      },
      {
        driver,
        enableAnalysis: !values["no-analysis"],
      },
    );

    const elapsedMs = Date.now() - startedAt;
    console.log(
      JSON.stringify(
        {
          strategyId,
          driver: driverMode,
          model: driverMode === "mlx" ? (values.model ?? resolveIntegrationModelId()) : "test",
          elapsedMs,
          summaryLength: result.summary.length,
          summary: result.summary,
        },
        null,
        2,
      ),
    );
  } finally {
    await driver.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
