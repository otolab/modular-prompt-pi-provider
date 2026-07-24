import type { PiProviderYamlConfig } from "../../../src/pi-provider-config.js";
import { INTEGRATION_DRIVER_CAPABILITIES } from "./driver-capabilities.js";

/** integration 用レガシー models[] エントリ */
export function buildLegacyModelEntry(modelId: string) {
  return {
    model: modelId,
    provider: "mlx" as const,
    capabilities: INTEGRATION_DRIVER_CAPABILITIES,
    maxOutputTokens: 128,
    defaultOptions: { maxTokens: 64, temperature: 0 },
  };
}

/** 論理モデル passthrough（model.id = 物理モデル = 論理名） */
export function buildPassthroughConfig(modelId: string): PiProviderYamlConfig {
  return {
    models: [buildLegacyModelEntry(modelId)],
    processes: {
      default: { model: modelId },
    },
  };
}

/** virtualModel passthrough（modelSet 経由） */
export function buildVirtualPassthroughConfig(
  modelId: string,
  virtualModel = "virtual-chat-it",
): PiProviderYamlConfig {
  return {
    models: [buildLegacyModelEntry(modelId)],
    modelSets: {
      default: { chat: modelId, default: modelId },
    },
    workflow: {
      chat: {
        type: "passthrough",
        modelSet: "default",
        virtualModel,
      },
    },
  };
}

/** virtualModel agentic */
export function buildVirtualAgenticConfig(
  modelId: string,
  virtualModel = "virtual-agentic-it",
): PiProviderYamlConfig {
  return {
    models: [buildLegacyModelEntry(modelId)],
    modelSets: {
      default: { chat: modelId, default: modelId },
    },
    workflow: {
      agentic: {
        type: "agentic",
        modelSet: "default",
        virtualModel,
      },
    },
  };
}
