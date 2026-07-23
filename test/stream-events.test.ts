import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Api, AssistantMessageEvent, Context, Model } from "@earendil-works/pi-ai";
import type { QueryOptions } from "@modular-prompt/driver";
import { TestDriver } from "@modular-prompt/driver";
import { API_ID, PROVIDER_ID } from "../src/constants.js";
import { getActiveStreamSessionId, resetActiveStreamSessionId } from "../src/cache/session-context.js";
import { getDriverForLogicalModel } from "../src/driver/pool.js";
import { getResolvedProviderConfig } from "../src/driver/service.js";
import { streamModularPrompt } from "../src/stream-simple.js";
import { createResolvedProviderConfig } from "../src/config.js";

vi.mock("../src/driver/pool.js", () => ({
  getDriverForModel: vi.fn(),
  getDriverForLogicalModel: vi.fn(),
  closeAllDrivers: vi.fn(),
  closeActiveDriver: vi.fn(),
}));

vi.mock("../src/driver/service.js", () => ({
  getApplicationConfig: vi.fn(),
  getResolvedProviderConfig: vi.fn(),
  initApplicationConfig: vi.fn(),
  initResolvedProviderConfig: vi.fn(),
  getAIService: vi.fn(),
  resetAIService: vi.fn(),
}));

const model = {
  id: "test-model",
  name: "test",
  api: API_ID,
  provider: PROVIDER_ID,
  baseUrl: "local://test",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  contextWindow: 128_000,
  maxTokens: 8_192,
} as Model<Api>;

function mockResolvedConfig() {
  return createResolvedProviderConfig({
    providers: {
      mlx: { cacheDir: "/tmp/modular-prompt-cache" },
    },
    models: {
      "test-model": {
        provider: "mlx",
        model: "mlx-community/test-model",
        defaultQueryOptions: { maxTokens: 8192 },
      },
    },
  });
}

function baseContext(): Context {
  return {
    systemPrompt: "You are a helpful assistant.",
    messages: [
      { role: "user", content: "Count from 1 to 3", timestamp: Date.now() },
    ],
  };
}

function indexOfEvent(events: AssistantMessageEvent[], type: AssistantMessageEvent["type"]): number {
  return events.findIndex((event) => event.type === type);
}

async function collectStream(stream: ReturnType<typeof streamModularPrompt>) {
  const events: AssistantMessageEvent[] = [];
  for await (const event of stream) {
    events.push(event);
  }
  const message = await stream.result();
  return { events, message };
}

describe("streamModularPrompt (TestDriver)", () => {
  beforeEach(() => {
    vi.mocked(getDriverForLogicalModel).mockReset();
    vi.mocked(getResolvedProviderConfig).mockReturnValue(mockResolvedConfig());
    resetActiveStreamSessionId();
  });

  it("emits start → text_* → done（Pi handleStreaming 相当）", async () => {
    vi.mocked(getDriverForLogicalModel).mockResolvedValue(
      new TestDriver({ responses: ["1 2 3"] }),
    );

    const stream = streamModularPrompt(model, baseContext());
    const { events, message } = await collectStream(stream);

    expect(getDriverForLogicalModel).toHaveBeenCalledWith("test-model");
    expect(events[0]?.type).toBe("start");
    expect(events.at(-1)?.type).toBe("done");

    const textStart = indexOfEvent(events, "text_start");
    const textEnd = indexOfEvent(events, "text_end");
    expect(textStart).toBeGreaterThanOrEqual(0);
    expect(textEnd).toBeGreaterThan(textStart);

    const streamedText = events
      .filter((e): e is Extract<AssistantMessageEvent, { type: "text_delta" }> => e.type === "text_delta")
      .map((e) => e.delta)
      .join("");
    expect(streamedText.length).toBeGreaterThan(0);

    const textEndEvent = events[textEnd];
    expect(textEndEvent?.type).toBe("text_end");
    if (textEndEvent?.type === "text_end") {
      expect(textEndEvent.content).toBe("1 2 3");
    }

    expect(message.stopReason).toBe("stop");
    expect(message.content.some((block) => block.type === "text")).toBe(true);

    for (const event of events) {
      if ("partial" in event) {
        expect(event.partial.role).toBe("assistant");
        expect(event.partial.provider).toBe(PROVIDER_ID);
      }
    }
  });

  it("emits error event instead of throwing when driver fails", async () => {
    vi.mocked(getDriverForLogicalModel).mockResolvedValue(new TestDriver({ responses: [] }));

    const { events, message } = await collectStream(
      streamModularPrompt(model, baseContext()),
    );

    expect(events[0]?.type).toBe("start");
    const last = events.at(-1);
    expect(last?.type).toBe("error");
    if (last?.type === "error") {
      expect(last.reason).toBe("error");
    }
    expect(message.stopReason).toBe("error");
    expect(message.errorMessage).toBeTruthy();
  });

  it("emits toolcall_* after text_end when TestDriver returns toolCalls", async () => {
    vi.mocked(getDriverForLogicalModel).mockResolvedValue(
      new TestDriver({
        responses: [
          {
            content: "",
            toolCalls: [
              { id: "tc1", name: "read", arguments: { path: "README.md" } },
            ],
            finishReason: "tool_calls",
          },
        ],
      }),
    );

    const { events, message } = await collectStream(
      streamModularPrompt(model, baseContext()),
    );

    const textEnd = indexOfEvent(events, "text_end");
    const toolStart = indexOfEvent(events, "toolcall_start");
    const toolEnd = indexOfEvent(events, "toolcall_end");
    expect(textEnd).toBeGreaterThanOrEqual(0);
    expect(toolStart).toBeGreaterThan(textEnd);
    expect(toolEnd).toBeGreaterThan(toolStart);

    const last = events.at(-1);
    expect(last?.type).toBe("done");
    if (last?.type === "done") {
      expect(last.reason).toBe("toolUse");
    }
    expect(message.stopReason).toBe("toolUse");
    expect(message.content.some((block) => block.type === "toolCall")).toBe(true);
  });

  it("streamQuery に cache オプションと sessionId を渡す", async () => {
    let capturedOptions: QueryOptions | undefined;
    vi.mocked(getDriverForLogicalModel).mockResolvedValue(
      new TestDriver({
        responses: (_prompt, options) => {
          capturedOptions = options;
          return "ok";
        },
      }),
    );

    const { message } = await collectStream(
      streamModularPrompt(model, baseContext(), {
        sessionId: "pi-session-1",
        cacheRetention: "short",
      }),
    );

    expect(capturedOptions?.cache).toBe(true);
    expect(getActiveStreamSessionId()).toBe("pi-session-1");
    expect(message.stopReason).toBe("stop");
  });

  it("cacheRetention none のとき streamQuery cache は false", async () => {
    let capturedOptions: QueryOptions | undefined;
    vi.mocked(getDriverForLogicalModel).mockResolvedValue(
      new TestDriver({
        responses: (_prompt, options) => {
          capturedOptions = options;
          return "ok";
        },
      }),
    );

    await collectStream(
      streamModularPrompt(model, baseContext(), {
        cacheRetention: "none",
      }),
    );

    expect(capturedOptions?.cache).toBe(false);
  });

  it("virtualModel passthrough は modelSet 経由でストリームする", async () => {
    vi.mocked(getResolvedProviderConfig).mockReturnValue(
      createResolvedProviderConfig({
        models: {
          gemma: {
            provider: "mlx",
            model: "mlx-community/gemma",
            defaultQueryOptions: { maxTokens: 8192 },
          },
        },
        modelSets: {
          default: { chat: "gemma", default: "gemma" },
        },
        workflow: {
          chat: {
            type: "passthrough",
            modelSet: "default",
            virtualModel: "virtual-chat",
          },
        },
      }),
    );
    vi.mocked(getDriverForLogicalModel).mockResolvedValue(
      new TestDriver({ responses: ["virtual-ok"] }),
    );

    const virtualModel = { ...model, id: "virtual-chat" };
    const { events, message } = await collectStream(
      streamModularPrompt(virtualModel, baseContext()),
    );

    expect(getDriverForLogicalModel).toHaveBeenCalledWith("gemma");
    expect(events.at(-1)?.type).toBe("done");
    expect(message.stopReason).toBe("stop");
  });

  it("未登録 model.id は processes.default にフォールバックしてストリームする", async () => {
    vi.mocked(getResolvedProviderConfig).mockReturnValue(
      createResolvedProviderConfig({
        models: {
          fallback: {
            provider: "mlx",
            model: "mlx-community/fallback",
            defaultQueryOptions: { maxTokens: 8192 },
          },
        },
        processes: {
          default: { model: "fallback" },
        },
      }),
    );
    vi.mocked(getDriverForLogicalModel).mockResolvedValue(
      new TestDriver({ responses: ["from-fallback"] }),
    );

    const unknownModel = { ...model, id: "unknown-id" };
    const { events, message } = await collectStream(
      streamModularPrompt(unknownModel, baseContext()),
    );

    expect(getDriverForLogicalModel).toHaveBeenCalledWith("fallback");
    expect(events.at(-1)?.type).toBe("done");
    expect(message.stopReason).toBe("stop");
  });

  it("未登録 model.id でフォールバックも無効ならエラーメッセージに processes.default を含める", async () => {
    const config = createResolvedProviderConfig({
      models: {
        fallback: {
          provider: "mlx",
          model: "mlx-community/fallback",
          defaultQueryOptions: { maxTokens: 8192 },
        },
      },
      processes: {
        default: { model: "fallback" },
      },
    });
    config.processes.default = { model: "broken-fallback" };
    vi.mocked(getResolvedProviderConfig).mockReturnValue(config);

    const unknownModel = { ...model, id: "unknown-id" };
    const { message } = await collectStream(
      streamModularPrompt(unknownModel, baseContext()),
    );

    expect(message.errorMessage).toContain("unknown-id");
    expect(message.errorMessage).toContain("broken-fallback");
    expect(message.errorMessage).toContain("not a registered");
  });
});
