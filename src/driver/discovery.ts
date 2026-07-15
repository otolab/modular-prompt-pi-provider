import {
  AIService,
  type AIDriver,
  type ApplicationConfig,
  type DriverCapability,
  type ModelSpec,
} from "@modular-prompt/driver";

/** `MlxDriver.getCapabilities()` の戻り値（公開 API 形状） */
export interface MlxModelCapabilities {
  methods: string[];
  specialTokens: Record<string, unknown>;
  features: {
    hasChatTemplate?: boolean;
    vocabSize?: number;
    modelMaxLength?: number;
    chatTemplate?: {
      toolCallFormat?: {
        callStart?: string;
      };
    };
  };
}

interface DriverWithCapabilities {
  getCapabilities?: () => Promise<MlxModelCapabilities>;
}

const DEFAULT_MAX_INPUT_TOKENS = 128_000;

const BASE_MLX_CAPABILITIES: DriverCapability[] = ["streaming", "local", "chat"];

const PRESERVED_YAML_CAPABILITIES: DriverCapability[] = [
  "multilingual",
  "japanese",
  "large-context",
  "fast",
  "coding",
];

export function isModelDiscoveryEnabled(): boolean {
  return process.env.SKIP_MODEL_DISCOVERY !== "1";
}

/**
 * MLX `getCapabilities()` 結果を ModelSpec にマージする（純関数）。
 * `maxInputTokens` 未設定時のみ `modelMaxLength` を反映する（YAML 明示値は優先）。
 */
export function applyMlxCapabilitiesToModelSpec(
  spec: ModelSpec,
  caps: MlxModelCapabilities,
): ModelSpec {
  const discoveredMaxInput = caps.features.modelMaxLength;
  const maxInputTokens =
    spec.maxInputTokens != null
      ? spec.maxInputTokens
      : typeof discoveredMaxInput === "number" && discoveredMaxInput > 0
        ? discoveredMaxInput
        : DEFAULT_MAX_INPUT_TOKENS;

  return {
    ...spec,
    maxInputTokens,
    capabilities: inferDriverCapabilities(caps, spec),
  };
}

export function inferDriverCapabilities(
  caps: MlxModelCapabilities,
  spec: ModelSpec,
): DriverCapability[] {
  const result = new Set<DriverCapability>(BASE_MLX_CAPABILITIES);

  const textOnly = spec.driverOptions?.textOnly === true;
  if (!textOnly && caps.specialTokens?.vision) {
    result.add("vision");
  }

  if (caps.specialTokens?.thinking || caps.specialTokens?.reasoning) {
    result.add("reasoning");
  }

  const hasTools = Boolean(
    caps.features.chatTemplate?.toolCallFormat?.callStart ||
      caps.specialTokens?.tool_call,
  );
  if (hasTools) {
    result.add("tools");
    result.add("function-calling");
  }

  for (const cap of spec.capabilities) {
    if (PRESERVED_YAML_CAPABILITIES.includes(cap)) {
      result.add(cap);
    }
  }

  return [...result];
}

async function probeDriverCapabilities(
  driver: AIDriver,
): Promise<MlxModelCapabilities | undefined> {
  const probe = driver as DriverWithCapabilities;
  if (typeof probe.getCapabilities !== "function") {
    return undefined;
  }

  try {
    return await probe.getCapabilities();
  } catch {
    return undefined;
  }
}

/**
 * 1 モデルを MLX プローブして enrich する。失敗時は元の spec を返す。
 */
export async function discoverModelSpec(
  spec: ModelSpec,
  aiService: AIService,
): Promise<ModelSpec> {
  if (spec.provider !== "mlx") {
    return spec;
  }

  let driver: AIDriver | undefined;
  try {
    driver = await aiService.createDriver(spec);
    const caps = await probeDriverCapabilities(driver);
    if (!caps) {
      console.warn(`[discovery] getCapabilities unavailable for ${spec.model}`);
      return spec;
    }
    return applyMlxCapabilitiesToModelSpec(spec, caps);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[discovery] probe failed for ${spec.model}: ${message}`);
    return spec;
  } finally {
    await driver?.close();
  }
}

/**
 * ApplicationConfig の全モデルを逐次 discovery する（MLX 同時 1 制約）。
 */
export async function discoverApplicationConfig(
  config: ApplicationConfig,
): Promise<ApplicationConfig> {
  if (!isModelDiscoveryEnabled()) {
    return config;
  }

  const models = config.models ?? [];
  if (models.length === 0) {
    return config;
  }

  const aiService = new AIService(config);
  const discovered: ModelSpec[] = [];

  for (const spec of models) {
    discovered.push(await discoverModelSpec(spec, aiService));
  }

  return { ...config, models: discovered };
}
