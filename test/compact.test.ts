import { describe, expect, it } from "vitest";
import { TestDriver } from "@modular-prompt/driver";
import {
  listCompactStrategyIds,
  resolveCompactStrategy,
  runCompact,
} from "../src/compact/index.js";
import { loadStreamSummarizeProcedure } from "../src/compact/strategies/stream-summarize/module.js";

describe("compact registry", () => {
  it("stream-summarize を解決できる", () => {
    expect(listCompactStrategyIds()).toContain("stream-summarize");
    expect(resolveCompactStrategy("stream-summarize").id).toBe("stream-summarize");
  });

  it("未知の strategy はエラー", () => {
    expect(() => resolveCompactStrategy("missing")).toThrow(/Unknown compact strategy/);
  });
});

describe("stream-summarize strategy", () => {
  it("procedure.md を読み込める", () => {
    const procedure = loadStreamSummarizeProcedure();
    expect(procedure).toContain("## Goal");
    expect(procedure).toContain("圧縮の原則");
  });

  it("chunks を streamProcess で要約する", async () => {
    const driver = new TestDriver({
      responses: ["## Goal\nImplement compact mechanism"],
    });
    const result = await runCompact(
      "stream-summarize",
      {
        chunks: [
          { content: "user: add compact feature", usage: 10 },
          { content: "assistant: working on streamProcess", usage: 10 },
        ],
      },
      { driver },
    );

    expect(result.summary).toBe("## Goal\nImplement compact mechanism");
    expect(result.state.content).toBe(result.summary);
  });

  it("chunks が空ならエラー", async () => {
    const driver = new TestDriver({ responses: ["unused"] });
    await expect(
      runCompact("stream-summarize", { chunks: [] }, { driver }),
    ).rejects.toThrow(/at least one chunk/);
  });
});
