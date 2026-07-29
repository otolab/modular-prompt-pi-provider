import { afterAll, beforeAll, describe, it } from "vitest";
import {
  installModularPromptApiProvider,
  uninstallModularPromptApiProvider,
} from "../support/register-provider.js";
import {
  basicTextGeneration,
  handleStreaming,
  handleToolCall,
} from "../support/scenarios/stream.js";
import { getMlxProbe } from "../../integration/support/get-mlx-probe.js";
import {
  buildMlxOfficialModel,
  initMlxPassthroughConfig,
  installMlxRuntimeHarness,
} from "../support/mlx-runtime.js";

const probe = await getMlxProbe();

if (!probe.runtimeAvailable) {
  console.info(`[pi-official/mlx] stream tests skipped: ${probe.runtimeReason}`);
}

beforeAll(() => {
  installModularPromptApiProvider();
});

afterAll(() => {
  uninstallModularPromptApiProvider();
});

describe.skipIf(!probe.runtimeAvailable)("Pi official stream (MLX)", () => {
  const mlxModel = buildMlxOfficialModel(probe.modelId!);
  installMlxRuntimeHarness(probe);

  it("handleStreaming — イベント順序", async () => {
    initMlxPassthroughConfig(probe.modelId!);
    await handleStreaming(mlxModel);
  });

  it(
    "basicTextGeneration — 2 ターン完走",
    { retry: 2, timeout: 120_000 },
    async () => {
      initMlxPassthroughConfig(probe.modelId!);
      await basicTextGeneration(mlxModel);
    },
  );

  it(
    "handleToolCall — toolcall_* シーケンス",
    { retry: 2, timeout: 120_000 },
    async () => {
      initMlxPassthroughConfig(probe.modelId!);
      await handleToolCall(mlxModel);
    },
  );
});
