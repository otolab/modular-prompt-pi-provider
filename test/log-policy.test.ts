import { describe, expect, it, afterEach } from "vitest";
import {
  isDebugLoggingEnv,
  resolveLoggingPolicy,
} from "../src/logging/log-policy.js";

describe("resolveLoggingPolicy", () => {
  afterEach(() => {
    delete process.env.MODULAR_PROMPT_PI_DEBUG;
  });

  it("未指定時は none", () => {
    expect(resolveLoggingPolicy(undefined, { defaultDir: "/tmp/logs" })).toEqual({
      requestResponseLevel: "none",
      dir: "/tmp/logs",
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

  it("MODULAR_PROMPT_PI_DEBUG で full", () => {
    process.env.MODULAR_PROMPT_PI_DEBUG = "1";
    expect(
      resolveLoggingPolicy(undefined, { defaultDir: "/tmp/logs", debugEnv: true }),
    ).toEqual({
      requestResponseLevel: "full",
      dir: "/tmp/logs",
    });
  });

  it("logging セクションのみで minimal", () => {
    expect(
      resolveLoggingPolicy({ level: "info" }, { defaultDir: "/tmp/logs" }),
    ).toEqual({
      requestResponseLevel: "minimal",
      dir: "/tmp/logs",
    });
  });
});

describe("isDebugLoggingEnv", () => {
  afterEach(() => {
    delete process.env.MODULAR_PROMPT_PI_DEBUG;
  });

  it("1 / true / yes を認識する", () => {
    process.env.MODULAR_PROMPT_PI_DEBUG = "1";
    expect(isDebugLoggingEnv()).toBe(true);
    process.env.MODULAR_PROMPT_PI_DEBUG = "true";
    expect(isDebugLoggingEnv()).toBe(true);
  });
});
