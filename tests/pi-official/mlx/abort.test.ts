import { afterAll, beforeAll, describe, it } from "vitest";
import {
  installModularPromptApiProvider,
  uninstallModularPromptApiProvider,
} from "../support/register-provider.js";
import {
  testAbortSignal,
  testAbortThenNewMessage,
  testImmediateAbort,
} from "../support/scenarios/abort.js";
import { getMlxProbe } from "../../integration/support/get-mlx-probe.js";
import {
  buildMlxOfficialModel,
  initMlxPassthroughConfig,
  installMlxRuntimeHarness,
} from "../support/mlx-runtime.js";

const probe = await getMlxProbe();

if (!probe.runtimeAvailable) {
  console.info(`[pi-official/mlx] abort tests skipped: ${probe.runtimeReason}`);
}

beforeAll(() => {
  installModularPromptApiProvider();
});

afterAll(() => {
  uninstallModularPromptApiProvider();
});

describe.skipIf(!probe.runtimeAvailable)("Pi official abort (MLX)", () => {
  const mlxModel = buildMlxOfficialModel(probe.modelId!);
  installMlxRuntimeHarness(probe);

  it("testImmediateAbort", { retry: 2 }, async () => {
    initMlxPassthroughConfig(probe.modelId!);
    await testImmediateAbort(mlxModel);
  });

  it("testAbortSignal", { retry: 2, timeout: 120_000 }, async () => {
    initMlxPassthroughConfig(probe.modelId!);
    await testAbortSignal(mlxModel);
  });

  it("testAbortThenNewMessage", { retry: 2 }, async () => {
    initMlxPassthroughConfig(probe.modelId!);
    await testAbortThenNewMessage(mlxModel);
  });
});
