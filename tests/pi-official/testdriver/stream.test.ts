import "../support/vi-mocks.js";
import { describe, expect, it, vi } from "vitest";
import { TestDriver } from "@modular-prompt/driver";
import { getDriverForLogicalModel } from "../../../src/driver/pool.js";
import { buildPiOfficialModel } from "../support/model.js";
import { installOfficialProviderRegistry } from "../support/testdriver-suite.js";
import { installTestDriverHarness } from "../support/test-driver-harness.js";
import {
  basicTextGeneration,
  handleStreaming,
  handleToolCall,
} from "../support/scenarios/stream.js";

const model = buildPiOfficialModel();

installOfficialProviderRegistry();

describe("Pi official stream (TestDriver)", () => {
  describe("handleStreaming", () => {
    installTestDriverHarness(() => new TestDriver({ responses: ["1 2 3"] }));

    it("compat stream 経由で text_* イベント順序を満たす", async () => {
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

    it("compat complete 経由で 2 ターン完走し driver を複数回呼ぶ", async () => {
      await basicTextGeneration(model);
      // thinking marker プローブ等で追加呼び出しがあり得る
      expect(vi.mocked(getDriverForLogicalModel).mock.calls.length).toBeGreaterThanOrEqual(2);
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

    it("compat stream 経由で toolcall_* シーケンスを満たす", async () => {
      await handleToolCall(model);
    });
  });
});
