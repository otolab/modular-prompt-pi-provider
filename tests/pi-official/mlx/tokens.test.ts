import { afterAll, beforeAll, describe, it } from "vitest";
import {
  installModularPromptApiProvider,
  uninstallModularPromptApiProvider,
} from "../support/register-provider.js";
import { testTokensOnAbort } from "../support/scenarios/tokens.js";
import { getMlxProbe } from "../../integration/support/get-mlx-probe.js";
import {
  buildMlxOfficialModel,
  initMlxPassthroughConfig,
  installMlxRuntimeHarness,
} from "../support/mlx-runtime.js";

const probe = await getMlxProbe();

if (!probe.runtimeAvailable) {
  console.info(`[pi-official/mlx] tokens tests skipped: ${probe.runtimeReason}`);
}

beforeAll(() => {
  installModularPromptApiProvider();
});

afterAll(() => {
  uninstallModularPromptApiProvider();
});

describe.skipIf(!probe.runtimeAvailable)("Pi official tokens (MLX)", () => {
  const mlxModel = buildMlxOfficialModel(probe.modelId!);
  installMlxRuntimeHarness(probe);

  it(
    "testTokensOnAbort — 途中キャンセル時の usage",
    { retry: 2, timeout: 120_000 },
    async () => {
      initMlxPassthroughConfig(probe.modelId!);
      await testTokensOnAbort(mlxModel);
    },
  );
});
