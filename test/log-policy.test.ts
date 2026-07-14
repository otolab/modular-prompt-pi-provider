import { describe, expect, it } from "vitest";
import { resolveLoggingPolicy } from "../src/logging/log-policy.js";

describe("resolveLoggingPolicy", () => {
  it("logging 未指定時は none", () => {
    expect(resolveLoggingPolicy(undefined, { defaultDir: "/tmp/logs" })).toEqual({
      requestResponseLevel: "none",
      dir: "",
    });
  });

  it("YAML full を尊重する", () => {
    expect(
      resolveLoggingPolicy(
        { requestResponseLevel: "full", dir: "/custom" },
        { defaultDir: "/tmp/logs" },
      ),
    ).toEqual({
      requestResponseLevel: "full",
      dir: "/custom",
    });
  });

  it("logging セクションのみで minimal と default dir", () => {
    expect(
      resolveLoggingPolicy({ level: "info" }, { defaultDir: "/tmp/logs" }),
    ).toEqual({
      requestResponseLevel: "minimal",
      dir: "/tmp/logs",
    });
  });

  it("requestResponseLevel none は無効", () => {
    expect(
      resolveLoggingPolicy(
        { requestResponseLevel: "none", dir: "/tmp/logs" },
        { defaultDir: "/fallback" },
      ),
    ).toEqual({
      requestResponseLevel: "none",
      dir: "/tmp/logs",
    });
  });
});
