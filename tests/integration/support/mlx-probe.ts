import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CompiledPrompt } from "@modular-prompt/core";
import { AIService, type QueryResult } from "@modular-prompt/driver";
import { INTEGRATION_DRIVER_CAPABILITIES } from "./driver-capabilities.js";
import { resolveIntegrationModelId } from "./integration-model.js";
import { consumeStream, withTimeout } from "./timeout.js";

export interface MlxProbeResult {
  /** MLX 推論が 1 回成功する */
  runtimeAvailable: boolean;
  /** KV キャッシュが有効（非 VLM 等） */
  cacheSupported: boolean;
  modelId: string;
  runtimeReason?: string;
  cacheReason?: string;
}

const RUNTIME_PROBE_TIMEOUT_MS = 120_000;
const CACHE_PROBE_TIMEOUT_MS = 180_000;

const PROBE_PROMPT: CompiledPrompt = {
  instructions: [
    {
      type: "text",
      content: "You are a concise assistant. Reply with one short English word.",
    },
  ],
  data: [{ type: "text", content: "user: ping" }],
  output: [],
};

function buildModelSpec(modelId: string, cacheDir: string) {
  return {
    model: modelId,
    provider: "mlx" as const,
    capabilities: INTEGRATION_DRIVER_CAPABILITIES,
    maxOutputTokens: 32,
    driverOptions: { cacheDir },
    defaultOptions: { maxTokens: 16, temperature: 0 },
  };
}

async function runQuery(
  modelId: string,
  cacheDir: string,
  cache: boolean | "read-only",
): Promise<QueryResult> {
  const spec = buildModelSpec(modelId, cacheDir);
  const service = new AIService({ models: [spec] });
  const driver = await service.createDriver(spec);
  try {
    const { stream, result } = await driver.streamQuery(PROBE_PROMPT, {
      maxTokens: 16,
      cache,
    });
    await consumeStream(stream, CACHE_PROBE_TIMEOUT_MS);
    return await result;
  } finally {
    await driver.close();
  }
}

async function probeRuntime(modelId: string, cacheDir: string): Promise<string | undefined> {
  const final = await runQuery(modelId, cacheDir, false);
  if (final.finishReason === "error") {
    return final.content || "MLX probe returned finishReason=error";
  }
  return undefined;
}

async function probeCache(modelId: string, cacheDir: string): Promise<string | undefined> {
  const first = await runQuery(modelId, cacheDir, true);
  const second = await runQuery(modelId, cacheDir, true);

  const cacheRead = second.usage?.cacheReadTokens ?? 0;
  const cacheWrite = first.usage?.cacheWriteTokens ?? 0;
  if (cacheRead > 0 || cacheWrite > 0) {
    return undefined;
  }

  return (
    "KV cache inactive (VLM モデル、または非対応モデル). " +
    "INTEGRATION_MLX_MODEL に text LM を指定してください."
  );
}

/**
 * MLX 実機プローブ。失敗時は integration を skip する。
 */
export async function probeMlxIntegration(): Promise<MlxProbeResult> {
  const modelId = resolveIntegrationModelId();
  const unavailable: MlxProbeResult = {
    runtimeAvailable: false,
    cacheSupported: false,
    modelId,
  };

  if (process.env.SKIP_INTEGRATION === "1") {
    return { ...unavailable, runtimeReason: "SKIP_INTEGRATION=1" };
  }

  let cacheDir: string | undefined;
  try {
    cacheDir = await mkdtemp(join(tmpdir(), "mpp-mlx-probe-"));
    const runtimeReason = await withTimeout(
      probeRuntime(modelId, cacheDir),
      RUNTIME_PROBE_TIMEOUT_MS,
      "MLX runtime probe",
    );
    if (runtimeReason) {
      return { ...unavailable, runtimeReason };
    }

    let cacheReason: string | undefined;
    try {
      cacheReason = await withTimeout(
        probeCache(modelId, cacheDir),
        CACHE_PROBE_TIMEOUT_MS,
        "MLX cache probe",
      );
    } catch (error) {
      cacheReason = error instanceof Error ? error.message : String(error);
    }

    return {
      runtimeAvailable: true,
      cacheSupported: !cacheReason,
      modelId,
      cacheReason,
    };
  } catch (error) {
    return {
      ...unavailable,
      runtimeReason: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (cacheDir) {
      await rm(cacheDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
