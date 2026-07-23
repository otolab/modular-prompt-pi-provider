import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { runPiCompact } from "../src/compact/adapters/pi-hook.js";
import { initResolvedProviderConfig } from "../src/driver/service.js";
import { registerCompactionHooks } from "../src/hooks/compaction.js";

vi.mock("../src/compact/adapters/pi-hook.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/compact/adapters/pi-hook.js")>();
  return {
    ...actual,
    runPiCompact: vi.fn(),
  };
});

describe("registerCompactionHooks", () => {
  beforeEach(() => {
    vi.mocked(runPiCompact).mockReset();
  });

  it("processes.compaction 未設定時は何もしない", async () => {
    initResolvedProviderConfig({
      models: {
        default: {
          provider: "mlx",
          model: "mlx-community/test",
          defaultQueryOptions: { maxTokens: 1024 },
        },
      },
    });

    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const pi = {
      on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(event, handler);
      }),
    } as unknown as ExtensionAPI;

    registerCompactionHooks(pi);

    const handler = handlers.get("session_before_compact");
    expect(handler).toBeDefined();

    const result = await handler!(
      {
        type: "session_before_compact",
        preparation: {
          firstKeptEntryId: "keep-1",
          messagesToSummarize: [],
          turnPrefixMessages: [],
          isSplitTurn: false,
          tokensBefore: 100,
          fileOps: {
            read: new Set(),
            written: new Set(),
            edited: new Set(),
          },
          settings: {
            enabled: true,
            reserveTokens: 4096,
            keepRecentTokens: 20_000,
          },
        },
        branchEntries: [],
        reason: "manual",
        willRetry: false,
        signal: new AbortController().signal,
      },
      { ui: { notify: vi.fn() } },
    );

    expect(result).toBeUndefined();
    expect(runPiCompact).not.toHaveBeenCalled();
  });

  it("processes.compaction 設定時は runPiCompact を呼び compaction を返す", async () => {
    initResolvedProviderConfig({
      models: {
        "compact-model": {
          provider: "mlx",
          model: "mlx-community/test",
          defaultQueryOptions: { maxTokens: 1024 },
        },
      },
      processes: {
        compaction: { model: "compact-model" },
      },
      compact: {
        strategy: "stream-summarize",
        targetTokens: 2048,
      },
    });

    vi.mocked(runPiCompact).mockResolvedValue({
      summary: "summary text",
      firstKeptEntryId: "keep-1",
      tokensBefore: 5000,
    });

    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const notify = vi.fn();
    const pi = {
      on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(event, handler);
      }),
    } as unknown as ExtensionAPI;

    registerCompactionHooks(pi);

    const handler = handlers.get("session_before_compact");
    const signal = new AbortController().signal;
    const preparation = {
      firstKeptEntryId: "keep-1",
      messagesToSummarize: [
        {
          role: "user" as const,
          content: [{ type: "text" as const, text: "hello" }],
          timestamp: 1,
        },
      ],
      turnPrefixMessages: [],
      isSplitTurn: false,
      tokensBefore: 5000,
      fileOps: {
        read: new Set(),
        written: new Set(),
        edited: new Set(),
      },
      settings: {
        enabled: true,
        reserveTokens: 4096,
        keepRecentTokens: 20_000,
      },
    };

    const result = await handler!(
      {
        type: "session_before_compact",
        preparation,
        branchEntries: [],
        customInstructions: "keep tests",
        reason: "manual",
        willRetry: false,
        signal,
      },
      { ui: { notify } },
    );

    expect(runPiCompact).toHaveBeenCalledWith(
      expect.objectContaining({
        strategyId: "stream-summarize",
        preparation,
        customInstructions: "keep tests",
        targetTokens: 2048,
        compactionModel: "compact-model",
        signal,
      }),
    );
    expect(result).toEqual({
      compaction: {
        summary: "summary text",
        firstKeptEntryId: "keep-1",
        tokensBefore: 5000,
      },
    });
    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining("stream-summarize"),
      "info",
    );
  });
});
