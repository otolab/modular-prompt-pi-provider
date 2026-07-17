import { readFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { parseLogFile } from "../src/extract-log/log-reader.js";
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

    const entries = parseLogFile(logger.filePath);
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
    const entry = parseLogFile(logger.filePath)[0];
    expect(entry?.data).toMatchObject({
      hasContent: true,
      contentLength: 11,
      finishReason: "stop",
    });
  });

  it("task_registration を書く", async () => {
    logDir = await mkdtemp(join(tmpdir(), "mpp-log-test-"));
    const logger = new RequestLogger(12345, "0001", "full", logDir);
    await logger.logTaskRegistration("agentic", [
      {
        name: "analyze",
        taskType: "think",
        instruction: "read request",
      },
    ]);

    const entry = parseLogFile(logger.filePath)[0];
    expect(entry?.type).toBe("task_registration");
    expect(entry?.phase).toBe("agentic");
    expect(entry?.data).toEqual({
      taskCount: 1,
      tasks: [
        {
          name: "analyze",
          taskType: "think",
          instruction: "read request",
        },
      ],
    });
  });

  it("minimal の agentic llm_response は executionLog を要約する", async () => {
    logDir = await mkdtemp(join(tmpdir(), "mpp-log-test-"));
    const logger = new RequestLogger(12345, "0001", "minimal", logDir);
    await logger.logLlmResponse(
      "agentic",
      {
        output: "final answer",
        finishReason: "stop",
        executionLog: [{ taskType: "think" }, { taskType: "output" }],
        taskTypeCounts: { think: 1, output: 1 },
      },
      "chat",
    );

    const entry = parseLogFile(logger.filePath)[0];
    expect(entry?.data).toMatchObject({
      hasContent: true,
      contentLength: 12,
      finishReason: "stop",
      taskCount: 2,
      taskTypeCounts: { think: 1, output: 1 },
      model: "chat",
    });
  });
});
