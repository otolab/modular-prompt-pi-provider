import "../support/vi-mocks.js";
import { describe, expect, it } from "vitest";
import { TestDriver } from "@modular-prompt/driver";
import { complete } from "@earendil-works/pi-ai/compat";
import { buildPiOfficialModel } from "../support/model.js";
import { installOfficialProviderRegistry } from "../support/testdriver-suite.js";
import { installTestDriverHarness } from "../support/test-driver-harness.js";
import { assertDriverOverflowErrorSurfaces } from "../support/scenarios/context-overflow.js";

const model = buildPiOfficialModel();
const OVERFLOW_MESSAGE = "maximum sequence length exceeded";

installOfficialProviderRegistry();

describe("Pi official context-overflow (TestDriver)", () => {
  installTestDriverHarness(
    () =>
      new TestDriver({
        responses: () => {
          throw new Error(OVERFLOW_MESSAGE);
        },
      }),
  );

  it("driver の MLX overflow エラーが complete() 経由で AssistantMessage に載る", async () => {
    const response = await complete(model, {
      messages: [{ role: "user", content: "overflow probe", timestamp: Date.now() }],
    });

    assertDriverOverflowErrorSurfaces(response);
    expect(response.errorMessage).toBe(OVERFLOW_MESSAGE);
  });
});
