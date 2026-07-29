import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  installModularPromptApiProvider,
  uninstallModularPromptApiProvider,
} from "../support/register-provider.js";
import {
  assertMlxOverflowDetectableWithRewrite,
  testContextOverflow,
} from "../support/scenarios/context-overflow.js";
import { getMlxProbe } from "../../integration/support/get-mlx-probe.js";
import {
  buildMlxOfficialModel,
  initMlxPassthroughConfig,
  installMlxRuntimeHarness,
} from "../support/mlx-runtime.js";

const probe = await getMlxProbe();

if (!probe.runtimeAvailable) {
  console.info(`[pi-official/mlx] context-overflow tests skipped: ${probe.runtimeReason}`);
}

beforeAll(() => {
  installModularPromptApiProvider();
});

afterAll(() => {
  uninstallModularPromptApiProvider();
});

describe.skipIf(!probe.runtimeAvailable)("Pi official context-overflow (MLX)", () => {
  const mlxModel = buildMlxOfficialModel(probe.modelId!);
  installMlxRuntimeHarness(probe);

  it(
    "testContextOverflow — 巨大入力で overflow",
    { timeout: 300_000 },
    async () => {
      initMlxPassthroughConfig(probe.modelId!);
      const modelWithSmallWindow = {
        ...mlxModel,
        contextWindow: 4_096,
        maxTokens: 64,
      };
      const response = await testContextOverflow(modelWithSmallWindow);

      if (response.stopReason === "error" && response.errorMessage) {
        assertMlxOverflowDetectableWithRewrite(response, modelWithSmallWindow);
        return;
      }

      expect(
        response.stopReason,
        `expected error overflow, got stopReason=${response.stopReason}`,
      ).toBe("error");
    },
  );
});
