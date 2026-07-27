import "./support/vi-mocks.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDriver } from "@modular-prompt/driver";
import { complete } from "@earendil-works/pi-ai/compat";
import {
  installModularPromptApiProvider,
  uninstallModularPromptApiProvider,
} from "./support/register-provider.js";
import { buildPiOfficialModel } from "./support/model.js";
import { installTestDriverHarness } from "./support/test-driver-harness.js";
import {
  assertOverflowDetectableAfterRewrite,
  testContextOverflow,
} from "./support/scenarios/context-overflow.js";
import { getMlxProbe } from "../integration/support/get-mlx-probe.js";
import {
  buildMlxOfficialModel,
  initMlxPassthroughConfig,
  installMlxRuntimeHarness,
} from "./support/mlx-runtime.js";

const probe = await getMlxProbe();
const model = buildPiOfficialModel();
const OVERFLOW_MESSAGE = "maximum sequence length exceeded";

beforeAll(() => {
  installModularPromptApiProvider();
});

afterAll(() => {
  uninstallModularPromptApiProvider();
});

describe("Pi official context-overflow (TestDriver)", () => {
  installTestDriverHarness(
    () =>
      new TestDriver({
        responses: () => {
          throw new Error(OVERFLOW_MESSAGE);
        },
      }),
  );

  it("MLX 形式の overflow エラーを extension リライト後に検出できる", async () => {
    const response = await complete(model, {
      messages: [{ role: "user", content: "overflow probe", timestamp: Date.now() }],
    });

    assertOverflowDetectableAfterRewrite(response, model);
  });
});

describe.skipIf(!probe.runtimeAvailable)("Pi official context-overflow (MLX)", () => {
  const mlxModel = buildMlxOfficialModel(probe.modelId!);
  installMlxRuntimeHarness(probe);

  if (!probe.runtimeAvailable) {
    console.info(`[pi-official] MLX context-overflow tests skipped: ${probe.runtimeReason}`);
  }

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
        assertOverflowDetectableAfterRewrite(response, modelWithSmallWindow);
        return;
      }

      // 一部モデルは truncate して stop する — その場合は overflow 検証対象外
      expect(
        response.stopReason,
        `expected error overflow, got stopReason=${response.stopReason}`,
      ).toBe("error");
    },
  );
});
