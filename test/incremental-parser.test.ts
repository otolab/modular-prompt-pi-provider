import { describe, expect, it } from "vitest";
import { IncrementalThinkingParser } from "../src/adapter/incremental-parser.js";
import {
  KNOWN_THINKING_MARKERS,
  resolveThinkingMarkers,
} from "../src/adapter/thinking-markers.js";

const QWEN = KNOWN_THINKING_MARKERS[0]!;

function collect(parser: IncrementalThinkingParser, chunks: string[]) {
  const segments = [];
  for (const chunk of chunks) {
    segments.push(...parser.feed(chunk));
  }
  segments.push(...parser.flush());
  return segments;
}

describe("resolveThinkingMarkers", () => {
  it("specialTokens.thinking を優先しフォールバックと dedupe する", () => {
    const markers = resolveThinkingMarkers({
      thinking: {
        start: { text: "<custom>", id: 1 },
        end: { text: "</custom>", id: 2 },
      },
    });

    expect(markers[0]).toEqual({ start: "<custom>", end: "</custom>" });
    expect(markers.some((marker) => marker.start === QWEN.start)).toBe(true);
  });
});

describe("IncrementalThinkingParser", () => {
  it("通常テキストのみを text として流す", () => {
    const parser = new IncrementalThinkingParser([QWEN]);
    const segments = collect(parser, ["hello", " world"]);

    expect(segments).toEqual([
      { kind: "text", delta: "hello" },
      { kind: "text", delta: " world" },
    ]);
  });

  it("thinking ブロックを分離して text と thinking を出す", () => {
    const parser = new IncrementalThinkingParser([QWEN]);
    const raw = `${QWEN.start}deep thought${QWEN.end}visible answer`;
    const segments = collect(parser, [raw]);

    expect(segments).toEqual([
      { kind: "thinking", delta: "deep thought" },
      { kind: "thinking_end" },
      { kind: "text", delta: "visible answer" },
    ]);
  });

  it("開始タグがチャンク境界で分割されても検出する", () => {
    const parser = new IncrementalThinkingParser([QWEN]);
    const splitAt = QWEN.start.length - 3;
    const segments = collect(parser, [
      QWEN.start.slice(0, splitAt),
      `${QWEN.start.slice(splitAt)}reasoning${QWEN.end}ok`,
    ]);

    expect(segments).toEqual([
      { kind: "thinking", delta: "reasoning" },
      { kind: "thinking_end" },
      { kind: "text", delta: "ok" },
    ]);
  });

  it("終端タグがチャンク境界で分割されても検出する", () => {
    const parser = new IncrementalThinkingParser([QWEN]);
    const inner = `${QWEN.start}step${QWEN.end}answer`;
    const splitAt = inner.indexOf(QWEN.end) + 2;
    const segments = collect(parser, [inner.slice(0, splitAt), inner.slice(splitAt)]);

    expect(segments).toEqual([
      { kind: "thinking", delta: "step" },
      { kind: "thinking_end" },
      { kind: "text", delta: "answer" },
    ]);
  });

  it("Gemma-4 形式のマーカーを処理する", () => {
    const gemma = KNOWN_THINKING_MARKERS[1]!;
    const parser = new IncrementalThinkingParser([gemma]);
    const raw = `${gemma.start}trace${gemma.end}final`;
    const segments = collect(parser, [raw]);

    expect(segments).toEqual([
      { kind: "thinking", delta: "trace" },
      { kind: "thinking_end" },
      { kind: "text", delta: "final" },
    ]);
  });
});
