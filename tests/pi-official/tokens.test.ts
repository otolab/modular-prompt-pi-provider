import "./support/vi-mocks.js";
import { afterAll, beforeAll, describe, it } from "vitest";
import { TestDriver } from "@modular-prompt/driver";
import {
  installModularPromptApiProvider,
  uninstallModularPromptApiProvider,
} from "./support/register-provider.js";
import { buildPiOfficialModel } from "./support/model.js";
import { installTestDriverHarness } from "./support/test-driver-harness.js";
import { testTokensOnAbort } from "./support/scenarios/tokens.js";
import { getMlxProbe } from "../integration/support/get-mlx-probe.js";
import {
  buildMlxOfficialModel,
  initMlxPassthroughConfig,
  installMlxRuntimeHarness,
} from "./support/mlx-runtime.js";

const probe = await getMlxProbe();
const model = buildPiOfficialModel();
const POEM_TEXT = "stanza ".repeat(400);

beforeAll(() => {
  installModularPromptApiProvider();
});

afterAll(() => {
  uninstallModularPromptApiProvider();
});

describe("Pi official tokens (TestDriver)", () => {
  installTestDriverHarness(
    () =>
      new TestDriver({
        responses: [POEM_TEXT],
      }),
  );

  it("testTokensOnAbort — 途中キャンセル時の usage", async () => {
    await testTokensOnAbort(model);
  });
});

describe.skipIf(!probe.runtimeAvailable)("Pi official tokens (MLX)", () => {
  const mlxModel = buildMlxOfficialModel(probe.modelId!);
  installMlxRuntimeHarness(probe);

  if (!probe.runtimeAvailable) {
    console.info(`[pi-official] MLX tokens tests skipped: ${probe.runtimeReason}`);
  }

  it(
    "testTokensOnAbort — 途中キャンセル時の usage",
    { retry: 2, timeout: 120_000 },
    async () => {
      initMlxPassthroughConfig(probe.modelId!);
      await testTokensOnAbort(mlxModel);
    },
  );
});
