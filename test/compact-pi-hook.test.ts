import { describe, expect, it } from "vitest";
import type { SessionBeforeCompactEvent } from "@earendil-works/pi-coding-agent";
import { TestDriver } from "@modular-prompt/driver";
import {
  preparationToCompactInput,
  runPiCompact,
} from "../src/compact/adapters/pi-hook.js";

type CompactionPreparation = SessionBeforeCompactEvent["preparation"];

function createPreparation(
  overrides: Partial<CompactionPreparation> = {},
): CompactionPreparation {
  return {
    firstKeptEntryId: "keep-1",
    messagesToSummarize: [
      {
        role: "user",
        content: [{ type: "text", text: "add compact feature" }],
        timestamp: 1,
      },
      {
        role: "user",
        content: [{ type: "text", text: "working on streamProcess" }],
        timestamp: 2,
      },
    ] as CompactionPreparation["messagesToSummarize"],
    turnPrefixMessages: [],
    isSplitTurn: false,
    tokensBefore: 1200,
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
    ...overrides,
  };
}

describe("preparationToCompactInput", () => {
  it("会話テキストを 1 チャンクに変換する", () => {
    const input = preparationToCompactInput(createPreparation());
    expect(input?.chunks).toHaveLength(1);
    expect(input?.chunks[0]?.partOf).toBe("session");
    expect(input?.chunks[0]?.content).toContain("add compact feature");
    expect(input?.chunks[0]?.content).toContain("working on streamProcess");
  });

  it("previousSummary を state に載せる", () => {
    const input = preparationToCompactInput(
      createPreparation({ previousSummary: "Earlier work on caching" }),
    );
    expect(input?.state?.content).toBe("Earlier work on caching");
  });

  it("customInstructions を追加チャンクにする", () => {
    const input = preparationToCompactInput(createPreparation(), {
      customInstructions: "Focus on API changes",
    });
    expect(input?.chunks).toHaveLength(2);
    expect(input?.chunks[1]?.partOf).toBe("custom-instructions");
    expect(input?.chunks[1]?.content).toBe("Focus on API changes");
  });

  it("要約対象メッセージが空なら undefined", () => {
    expect(
      preparationToCompactInput(
        createPreparation({ messagesToSummarize: [], turnPrefixMessages: [] }),
      ),
    ).toBeUndefined();
  });
});

describe("runPiCompact", () => {
  it("strategy 実行結果を Pi compaction 形式に変換する", async () => {
    const driver = new TestDriver({
      responses: ["## Goal\nImplement compact mechanism"],
    });

    const result = await runPiCompact({
      strategyId: "stream-summarize",
      preparation: createPreparation(),
      compactionModel: "default",
      getDriver: async () => driver,
    });

    expect(result).toEqual({
      summary: "## Goal\nImplement compact mechanism",
      firstKeptEntryId: "keep-1",
      tokensBefore: 1200,
    });
  });

  it("signal が abort 済みなら undefined", async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await runPiCompact({
      strategyId: "stream-summarize",
      preparation: createPreparation(),
      compactionModel: "default",
      signal: controller.signal,
      getDriver: async () => new TestDriver({ responses: ["unused"] }),
    });

    expect(result).toBeUndefined();
  });
});
