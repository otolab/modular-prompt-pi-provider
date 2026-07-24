import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { closeAllDrivers } from "../src/driver/pool.js";
import { registerSessionHooks } from "../src/hooks/session.js";

vi.mock("../src/driver/pool.js", () => ({
  closeAllDrivers: vi.fn(),
  closeActiveDriver: vi.fn(),
  getDriverForModel: vi.fn(),
}));

describe("registerSessionHooks", () => {
  beforeEach(() => {
    vi.mocked(closeAllDrivers).mockReset();
    vi.mocked(closeAllDrivers).mockResolvedValue(undefined);
  });

  it("session_shutdown で closeAllDrivers を呼ぶ", async () => {
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

    expect(closeAllDrivers).toHaveBeenCalledOnce();
  });

  it("onSessionStart 指定時は session_start でコールバックを呼ぶ", async () => {
    const onSessionStart = vi.fn().mockResolvedValue(undefined);
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const pi = {
      on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(event, handler);
      }),
    } as unknown as ExtensionAPI;

    registerSessionHooks(pi, { onSessionStart });

    const handler = handlers.get("session_start");
    expect(handler).toBeDefined();

    const isProjectTrusted = vi.fn().mockReturnValue(true);
    await handler!(
      { type: "session_start" },
      { cwd: "/tmp/project", isProjectTrusted },
    );

    expect(onSessionStart).toHaveBeenCalledWith("/tmp/project", true);
  });
});
