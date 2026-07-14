import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { closeActiveDriver } from "../src/driver/pool.js";
import { registerSessionHooks } from "../src/hooks/session.js";

vi.mock("../src/driver/pool.js", () => ({
  closeActiveDriver: vi.fn(),
}));

describe("registerSessionHooks", () => {
  beforeEach(() => {
    vi.mocked(closeActiveDriver).mockReset();
    vi.mocked(closeActiveDriver).mockResolvedValue(undefined);
  });

  it("session_shutdown で closeActiveDriver を呼ぶ", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const pi = {
      on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(event, handler);
      }),
    } as unknown as ExtensionAPI;

    registerSessionHooks(pi);

    expect(pi.on).toHaveBeenCalledWith("session_shutdown", expect.any(Function));

    const handler = handlers.get("session_shutdown");
    expect(handler).toBeDefined();
    await handler!({ type: "session_shutdown", reason: "quit" }, {});

    expect(closeActiveDriver).toHaveBeenCalledOnce();
  });
});
