import "./support/vi-mocks.js";
import { afterAll, beforeAll, describe, it } from "vitest";
import { TestDriver } from "@modular-prompt/driver";
import {
  installModularPromptApiProvider,
  uninstallModularPromptApiProvider,
} from "./support/register-provider.js";
import { buildPiOfficialModel } from "./support/model.js";
import { installTestDriverHarness } from "./support/test-driver-harness.js";
import { testToolCallWithoutResult } from "./support/scenarios/tool-call-without-result.js";
import { getMlxProbe } from "../integration/support/get-mlx-probe.js";
import {
  buildMlxOfficialModel,
  initMlxPassthroughConfig,
  installMlxRuntimeHarness,
} from "./support/mlx-runtime.js";

const probe = await getMlxProbe();
const model = buildPiOfficialModel();

beforeAll(() => {
  installModularPromptApiProvider();
});

afterAll(() => {
  uninstallModularPromptApiProvider();
});

describe("Pi official tool-call-without-result (TestDriver)", () => {
  installTestDriverHarness(
    () =>
      new TestDriver({
        responses: [
          {
            content: "",
            toolCalls: [
              {
                id: "tc-calc-1",
                name: "calculate",
                arguments: { expression: "25 * 18" },
              },
            ],
            finishReason: "tool_calls",
          },
          "2+2 is 4",
        ],
      }),
  );

  it("orphaned tool call をフィルタして次ターンが成功する", async () => {
    await testToolCallWithoutResult(model);
  });
});

describe.skipIf(!probe.runtimeAvailable)("Pi official tool-call-without-result (MLX)", () => {
  const mlxModel = buildMlxOfficialModel(probe.modelId!);
  installMlxRuntimeHarness(probe);

  if (!probe.runtimeAvailable) {
    console.info(
      `[pi-official] MLX tool-call-without-result tests skipped: ${probe.runtimeReason}`,
    );
  }

  it(
    "orphaned tool call をフィルタして次ターンが成功する",
    { retry: 2, timeout: 120_000 },
    async () => {
      initMlxPassthroughConfig(probe.modelId!);
      await testToolCallWithoutResult(mlxModel);
    },
  );
});
