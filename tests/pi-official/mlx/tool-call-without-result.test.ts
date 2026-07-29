import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  installModularPromptApiProvider,
  uninstallModularPromptApiProvider,
} from "../support/register-provider.js";
import { testToolCallWithoutResult } from "../support/scenarios/tool-call-without-result.js";
import { getMlxProbe } from "../../integration/support/get-mlx-probe.js";
import {
  buildMlxOfficialModel,
  initMlxPassthroughConfig,
  installMlxRuntimeHarness,
} from "../support/mlx-runtime.js";

const probe = await getMlxProbe();

if (!probe.runtimeAvailable) {
  console.info(
    `[pi-official/mlx] tool-call-without-result tests skipped: ${probe.runtimeReason}`,
  );
}

beforeAll(() => {
  installModularPromptApiProvider();
});

afterAll(() => {
  uninstallModularPromptApiProvider();
});

describe.skipIf(!probe.runtimeAvailable)("Pi official tool-call-without-result (MLX)", () => {
  const mlxModel = buildMlxOfficialModel(probe.modelId!);
  installMlxRuntimeHarness(probe);

  it(
    "orphaned tool call をフィルタして次ターンが成功する",
    { retry: 2, timeout: 120_000 },
    async () => {
      initMlxPassthroughConfig(probe.modelId!);
      await testToolCallWithoutResult(mlxModel);
    },
  );
});
