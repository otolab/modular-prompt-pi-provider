import { describe, expect, it } from "vitest";
import { mapStopReason, resolveStreamTermination } from "../src/adapter/finish-reason.js";
import type { QueryResult } from "@modular-prompt/driver";

describe("mapStopReason", () => {
  it("maps driver finish reasons to Pi stop reasons", () => {
    expect(mapStopReason("stop")).toBe("stop");
    expect(mapStopReason("length")).toBe("length");
    expect(mapStopReason("tool_calls")).toBe("toolUse");
    expect(mapStopReason(undefined)).toBe("stop");
  });
});

describe("resolveStreamTermination", () => {
  const baseResult: QueryResult = { content: "ok", finishReason: "stop" };

  it("returns aborted when signal is aborted", () => {
    const controller = new AbortController();
    controller.abort();
    const resolved = resolveStreamTermination(baseResult, controller.signal);
    expect(resolved).toEqual({ event: "error", stopReason: "aborted" });
  });

  it("returns error for driver error finish", () => {
    const resolved = resolveStreamTermination(
      { ...baseResult, finishReason: "error" },
      undefined,
    );
    expect(resolved).toEqual({ event: "error", stopReason: "error" });
  });

  it("returns done for normal stop", () => {
    const resolved = resolveStreamTermination(baseResult, undefined);
    expect(resolved).toEqual({
      event: "done",
      stopReason: "stop",
      doneReason: "stop",
    });
  });
});
