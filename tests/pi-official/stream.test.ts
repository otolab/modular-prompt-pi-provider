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
  basicTextGeneration,
  handleStreaming,
  handleToolCall,
} from "./support/scenarios/stream.js";
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

describe("Pi official stream (TestDriver)", () => {
  describe("handleStreaming", () => {
    installTestDriverHarness(() => new TestDriver({ responses: ["1 2 3"] }));

    it("イベント順序", async () => {
      await handleStreaming(model);
    });
  });

  describe("basicTextGeneration", () => {
    installTestDriverHarness(
      () =>
        new TestDriver({
          responses: (prompt) => {
            const serialized = JSON.stringify(prompt.data);
            if (serialized.includes("Goodbye test successful")) {
              return "Goodbye test successful";
            }
            return "Hello test successful";
          },
        }),
    );

    it("2 ターン完走", async () => {
      await basicTextGeneration(model);
    });
  });

  describe("handleToolCall", () => {
    installTestDriverHarness(
      () =>
        new TestDriver({
          responses: [
            {
              content: "",
              toolCalls: [
                {
                  id: "tc-official-1",
                  name: "math_operation",
                  arguments: { a: 15, b: 27, operation: "add" },
                },
              ],
              finishReason: "tool_calls",
            },
          ],
        }),
    );

    it("toolcall_* シーケンス", async () => {
      await handleToolCall(model);
    });
  });
});

describe.skipIf(!probe.runtimeAvailable)("Pi official stream (MLX)", () => {
  const mlxModel = buildMlxOfficialModel(probe.modelId!);
  installMlxRuntimeHarness(probe);

  if (!probe.runtimeAvailable) {
    console.info(`[pi-official] MLX stream tests skipped: ${probe.runtimeReason}`);
  }

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
});
