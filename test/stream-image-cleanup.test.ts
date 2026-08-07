import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Api, Context, Model } from "@earendil-works/pi-ai";
import { TestDriver } from "@modular-prompt/driver";
import { API_ID, PROVIDER_ID } from "../src/constants.js";
import { createResolvedProviderConfig } from "../src/config.js";
import { getDriverForLogicalModel } from "../src/driver/pool.js";
import { getResolvedProviderConfig } from "../src/driver/service.js";
import { streamModularPrompt } from "../src/stream-simple.js";

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

const TEMP_DIR = join(tmpdir(), "modular-prompt-pi-provider-images");

const model = {
  id: "test-model",
  name: "test",
  api: API_ID,
  provider: PROVIDER_ID,
  baseUrl: "local://test",
  reasoning: false,
  input: ["text", "image"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  contextWindow: 128_000,
  maxTokens: 8_192,
} as Model<Api>;

function mockResolvedConfig() {
  return createResolvedProviderConfig({
    models: {
      "test-model": {
        provider: "mlx",
        model: "mlx-community/test-model",
        defaultQueryOptions: { maxTokens: 8192 },
      },
    },
  });
}

function imageContext(): Context {
  return {
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Describe the image." },
          {
            type: "image",
            mimeType: "image/png",
            data: Buffer.from("png-bytes").toString("base64"),
          },
        ],
        timestamp: Date.now(),
      },
    ],
  };
}

function listTempImages(): string[] {
  if (!existsSync(TEMP_DIR)) {
    return [];
  }
  return readdirSync(TEMP_DIR);
}

describe("stream image temp file cleanup", () => {
  beforeEach(() => {
    vi.mocked(getDriverForLogicalModel).mockReset();
    vi.mocked(getResolvedProviderConfig).mockReturnValue(mockResolvedConfig());
    mkdirSync(TEMP_DIR, { recursive: true });
  });

  it("ストリーム中の abort 後も一時画像を削除する", async () => {
    const before = new Set(listTempImages());
    const controller = new AbortController();

    vi.mocked(getDriverForLogicalModel).mockResolvedValue(
      new TestDriver({ responses: ["x".repeat(400)], delay: 20 }),
    );

    const stream = streamModularPrompt(model, imageContext(), {
      signal: controller.signal,
    });

    let aborted = false;
    for await (const event of stream) {
      if (!aborted && event.type === "text_delta") {
        controller.abort();
        aborted = true;
      }
    }

    const message = await stream.result();
    expect(message.stopReason).toBe("aborted");

    const leaked = listTempImages().filter((name) => !before.has(name));
    expect(leaked).toEqual([]);
  });

  it("開始前 abort では一時画像を作成しない", async () => {
    const before = new Set(listTempImages());
    const controller = new AbortController();
    controller.abort();

    vi.mocked(getDriverForLogicalModel).mockResolvedValue(
      new TestDriver({ responses: ["ok"] }),
    );

    const stream = streamModularPrompt(model, imageContext(), {
      signal: controller.signal,
    });
    for await (const _event of stream) {
      // drain
    }
    const message = await stream.result();
    expect(message.stopReason).toBe("aborted");

    const leaked = listTempImages().filter((name) => !before.has(name));
    expect(leaked).toEqual([]);
  });
});
