import { readFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { parseLogFile, summarizeRequestLog } from "../src/logging/extract-log.js";
import {
  RequestLogger,
  resetRequestSeqCounter,
} from "../src/logging/request-logger.js";

describe("RequestLogger", () => {
  let logDir: string;

  afterEach(async () => {
    resetRequestSeqCounter();
    if (logDir) {
      await rm(logDir, { recursive: true, force: true });
    }
  });

  it("full で in / prompt / out を JSONL に書く", async () => {
    logDir = await mkdtemp(join(tmpdir(), "mpp-log-test-"));
    const logger = new RequestLogger(12345, "0001", "full", logDir);

    await logger.logIn("stream", { model: "m1" });
    await logger.logPrompt("stream", "hello");
    await logger.logOut("stream", { stopReason: "stop" });

    const content = await readFile(logger.filePath, "utf-8");
    const entries = parseLogFile(content);
    expect(entries.map((entry) => entry.type)).toEqual(["in", "prompt", "out"]);
    expect(entries[0]?.data).toEqual({ model: "m1" });
  });

  it("none では書き込まない", async () => {
    logDir = await mkdtemp(join(tmpdir(), "mpp-log-test-"));
    const logger = new RequestLogger(12345, "0001", "none", logDir);
    await logger.logIn("stream", { model: "m1" });
    await expect(readFile(logger.filePath, "utf-8")).rejects.toThrow();
  });

  it("minimal の llm_response は要約する", async () => {
    logDir = await mkdtemp(join(tmpdir(), "mpp-log-test-"));
    const logger = new RequestLogger(12345, "0001", "minimal", logDir);
    await logger.logLlmResponse("stream", {
      content: "long answer",
      finishReason: "stop",
      usage: { promptTokens: 1, completionTokens: 2 },
    });
    const content = await readFile(logger.filePath, "utf-8");
    const entry = parseLogFile(content)[0];
    expect(entry?.data).toMatchObject({
      hasContent: true,
      contentLength: 11,
      finishReason: "stop",
    });
  });
});

describe("extract-log helpers", () => {
  it("summarizeRequestLog が types を集約する", () => {
    const summary = summarizeRequestLog("test.jsonl", [
      {
        timestamp: "2026-01-01T00:00:00.000Z",
        pid: 1,
        seqId: "0001",
        phase: "stream",
        type: "in",
        data: {},
      },
      {
        timestamp: "2026-01-01T00:00:01.000Z",
        pid: 1,
        seqId: "0001",
        phase: "stream",
        type: "out",
        data: {},
      },
    ]);
    expect(summary.types).toEqual(["in", "out"]);
    expect(summary.seqId).toBe("0001");
  });
});
