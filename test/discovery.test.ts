import { describe, expect, it, vi } from "vitest";
import type { AIDriver, AIService, ModelSpec } from "@modular-prompt/driver";
import {
  applyMlxCapabilitiesToModelSpec,
  discoverApplicationConfig,
  discoverModelSpec,
  inferDriverCapabilities,
  isModelDiscoveryEnabled,
} from "../src/driver/discovery.js";

function baseSpec(overrides: Partial<ModelSpec> = {}): ModelSpec {
  return {
    model: "mlx-community/test-model",
    provider: "mlx",
    capabilities: ["streaming", "local", "japanese", "chat"],
    maxInputTokens: 128_000,
    maxOutputTokens: 8_192,
    priority: 10,
    ...overrides,
  };
}

function sampleCaps(overrides: Partial<{
  modelMaxLength: number;
  vision: boolean;
  thinking: boolean;
  tools: boolean;
}> = {}) {
  return {
    methods: ["capabilities", "chat"],
    specialTokens: {
      ...(overrides.vision ? { vision: { text: "<|vision|>", id: 1 } } : {}),
      ...(overrides.thinking ? { thinking: { start: { text: "<t>", id: 1 }, end: { text: "</t>", id: 2 } } } : {}),
      ...(overrides.tools ? { tool_call: { start: { text: "<tool>", id: 3 }, end: { text: "</tool>", id: 4 } } } : {}),
    },
    features: {
      hasChatTemplate: true,
      modelMaxLength: overrides.modelMaxLength ?? 32_768,
      chatTemplate: overrides.tools
        ? { toolCallFormat: { callStart: "<tool>" } }
        : undefined,
    },
  };
}

describe("inferDriverCapabilities", () => {
  it("base + yaml の japanese を保持する", () => {
    const caps = inferDriverCapabilities(sampleCaps(), baseSpec());
    expect(caps).toContain("streaming");
    expect(caps).toContain("chat");
    expect(caps).toContain("japanese");
    expect(caps).not.toContain("vision");
  });

  it("vision / reasoning / tools を検出する", () => {
    const caps = inferDriverCapabilities(
      sampleCaps({ vision: true, thinking: true, tools: true }),
      baseSpec(),
    );
    expect(caps).toContain("vision");
    expect(caps).toContain("reasoning");
    expect(caps).toContain("tools");
    expect(caps).toContain("function-calling");
  });

  it("textOnly のとき vision を付けない", () => {
    const caps = inferDriverCapabilities(
      sampleCaps({ vision: true }),
      baseSpec({ driverOptions: { textOnly: true } }),
    );
    expect(caps).not.toContain("vision");
  });
});

describe("applyMlxCapabilitiesToModelSpec", () => {
  it("modelMaxLength を maxInputTokens に反映する", () => {
    const enriched = applyMlxCapabilitiesToModelSpec(
      baseSpec(),
      sampleCaps({ modelMaxLength: 65_536 }),
    );
    expect(enriched.maxInputTokens).toBe(65_536);
    expect(enriched.capabilities).toContain("chat");
  });

  it("YAML で maxInputTokens 指定時は上書きしない", () => {
    const enriched = applyMlxCapabilitiesToModelSpec(
      baseSpec({ maxInputTokens: 16_384 }),
      sampleCaps({ modelMaxLength: 65_536 }),
    );
    expect(enriched.maxInputTokens).toBe(16_384);
  });
});

describe("discoverModelSpec", () => {
  it("getCapabilities 結果で enrich して driver を close する", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const getCapabilities = vi.fn().mockResolvedValue(
      sampleCaps({ modelMaxLength: 40_960, thinking: true }),
    );
    const createDriver = vi.fn().mockResolvedValue({
      getCapabilities,
      close,
    } as unknown as AIDriver);

    const aiService = { createDriver } as unknown as AIService;
    const result = await discoverModelSpec(baseSpec(), aiService);

    expect(createDriver).toHaveBeenCalledOnce();
    expect(getCapabilities).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(result.maxInputTokens).toBe(40_960);
    expect(result.capabilities).toContain("reasoning");
  });

  it("probe 失敗時は元の spec を返す", async () => {
    const aiService = {
      createDriver: vi.fn().mockRejectedValue(new Error("mlx unavailable")),
    } as unknown as AIService;

    const spec = baseSpec({ maxInputTokens: 12_000 });
    await expect(discoverModelSpec(spec, aiService)).resolves.toEqual(spec);
  });
});

describe("discoverApplicationConfig", () => {
  it("SKIP_MODEL_DISCOVERY=1 のときプローブしない", async () => {
    process.env.SKIP_MODEL_DISCOVERY = "1";
    const config = { models: [baseSpec({ maxInputTokens: 9_999 })] };

    await expect(discoverApplicationConfig(config)).resolves.toEqual(config);
    delete process.env.SKIP_MODEL_DISCOVERY;
  });

  it("isModelDiscoveryEnabled は環境変数で切り替わる", () => {
    process.env.SKIP_MODEL_DISCOVERY = "1";
    expect(isModelDiscoveryEnabled()).toBe(false);
    delete process.env.SKIP_MODEL_DISCOVERY;
    expect(isModelDiscoveryEnabled()).toBe(true);
  });
});
