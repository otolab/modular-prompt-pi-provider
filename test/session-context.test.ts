import { describe, expect, it, beforeEach } from "vitest";
import {
  getActiveStreamSessionId,
  resetActiveStreamSessionId,
  setActiveStreamSessionId,
} from "../src/cache/session-context.js";

describe("session-context", () => {
  beforeEach(() => {
    resetActiveStreamSessionId();
  });

  it("setActiveStreamSessionId で sessionId を保持する", () => {
    setActiveStreamSessionId("session-abc");
    expect(getActiveStreamSessionId()).toBe("session-abc");
  });

  it("undefined でクリアできる", () => {
    setActiveStreamSessionId("session-abc");
    setActiveStreamSessionId(undefined);
    expect(getActiveStreamSessionId()).toBeUndefined();
  });
});
