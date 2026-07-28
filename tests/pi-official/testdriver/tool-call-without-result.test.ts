import "../support/vi-mocks.js";
import { describe, expect, it, vi } from "vitest";
import type { CompiledPrompt } from "@modular-prompt/core";
import { TestDriver } from "@modular-prompt/driver";
import { getDriverForLogicalModel } from "../../../src/driver/pool.js";
import { buildPiOfficialModel } from "../support/model.js";
import { installOfficialProviderRegistry } from "../support/testdriver-suite.js";
import { installTestDriverHarness } from "../support/test-driver-harness.js";
import { testToolCallWithoutResult } from "../support/scenarios/tool-call-without-result.js";

const model = buildPiOfficialModel();
const ORPHANED_TOOL_ID = "tc-calc-1";

installOfficialProviderRegistry();

describe("Pi official tool-call-without-result (TestDriver)", () => {
  let secondPrompt: CompiledPrompt | undefined;
  let callCount = 0;

  installTestDriverHarness(
    () =>
      new TestDriver({
        responses: (prompt) => {
          callCount += 1;
          if (callCount === 1) {
            return {
              content: "",
              toolCalls: [
                {
                  id: ORPHANED_TOOL_ID,
                  name: "calculate",
                  arguments: { expression: "25 * 18" },
                },
              ],
              finishReason: "tool_calls",
            };
          }
          secondPrompt = prompt;
          return "2+2 is 4";
        },
      }),
  );

  it("orphaned tool call 付き context でも 2 ターン目が error にならない", async () => {
    await testToolCallWithoutResult(model);

    expect(callCount).toBeGreaterThanOrEqual(2);
    expect(secondPrompt).toBeDefined();
    const serialized = JSON.stringify(secondPrompt!.data);
    expect(serialized).toContain("2+2");
    // compat 経路では orphaned tool call は context に残る（クラウド API 向けフィルタは HTTP 層）。
    // 本拡張がクラッシュせず次ターンを処理できることをシナリオ側で検証する。
    expect(serialized).toContain(ORPHANED_TOOL_ID);
    expect(vi.mocked(getDriverForLogicalModel).mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
