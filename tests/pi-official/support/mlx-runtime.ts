import { afterAll, afterEach } from "vitest";
import { closeActiveDriver } from "../../../src/driver/pool.js";
import { initApplicationConfig, resetAIService } from "../../../src/driver/service.js";
import { buildPassthroughConfig } from "../../integration/support/build-integration-config.js";
import { buildPiModel } from "../../integration/support/pi-model.js";
import type { MlxProbeResult } from "../../integration/support/mlx-probe.js";

/** MLX 実機シナリオ向けの config 初期化と driver 後片付け */
export function installMlxRuntimeHarness(probe: MlxProbeResult): void {
  afterEach(async () => {
    await closeActiveDriver();
    resetAIService();
  });

  afterAll(() => {
    resetAIService();
  });
}

export function initMlxPassthroughConfig(modelId: string): void {
  initApplicationConfig(buildPassthroughConfig(modelId));
}

export function buildMlxOfficialModel(modelId: string) {
  return buildPiModel(modelId);
}
