import "../support/vi-mocks.js";
import { describe, it } from "vitest";
import { TestDriver } from "@modular-prompt/driver";
import { buildPiOfficialModel } from "../support/model.js";
import { installOfficialProviderRegistry } from "../support/testdriver-suite.js";
import { installTestDriverHarness } from "../support/test-driver-harness.js";
import {
  testAbortSignal,
  testAbortThenNewMessage,
  testImmediateAbort,
} from "../support/scenarios/abort.js";

const model = buildPiOfficialModel();
const LONG_TEXT = "A".repeat(200);

installOfficialProviderRegistry();

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
