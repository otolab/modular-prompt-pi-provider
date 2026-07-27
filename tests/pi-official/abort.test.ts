import "./support/vi-mocks.js";
import { afterAll, beforeAll, describe, it } from "vitest";
import { TestDriver } from "@modular-prompt/driver";
import {
  installModularPromptApiProvider,
  uninstallModularPromptApiProvider,
} from "./support/register-provider.js";
import { buildPiOfficialModel } from "./support/model.js";
import { installTestDriverHarness } from "./support/test-driver-harness.js";
import {
  testAbortSignal,
  testAbortThenNewMessage,
  testImmediateAbort,
} from "./support/scenarios/abort.js";
import { getMlxProbe } from "../integration/support/get-mlx-probe.js";
import {
  buildMlxOfficialModel,
  initMlxPassthroughConfig,
  installMlxRuntimeHarness,
} from "./support/mlx-runtime.js";

const probe = await getMlxProbe();
const model = buildPiOfficialModel();
const LONG_TEXT = "A".repeat(200);

beforeAll(() => {
  installModularPromptApiProvider();
});

afterAll(() => {
  uninstallModularPromptApiProvider();
});

describe("Pi official abort (TestDriver)", () => {
  installTestDriverHarness(
    () =>
      new TestDriver({
        responses: [LONG_TEXT, "name one two three four five", "4", "4"],
      }),
  );

  it("testImmediateAbort — 即時キャンセル", async () => {
    await testImmediateAbort(model);
  });

  it("testAbortSignal — 途中キャンセルと follow-up", async () => {
    await testAbortSignal(model);
  });

  it("testAbortThenNewMessage — 空応答キャンセル後の継続", async () => {
    await testAbortThenNewMessage(model);
  });
});

describe.skipIf(!probe.runtimeAvailable)("Pi official abort (MLX)", () => {
  const mlxModel = buildMlxOfficialModel(probe.modelId!);
  installMlxRuntimeHarness(probe);

  if (!probe.runtimeAvailable) {
    console.info(`[pi-official] MLX abort tests skipped: ${probe.runtimeReason}`);
  }

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
