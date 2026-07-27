import type {
  AssistantMessage,
  AssistantMessageEventStream,
} from "@earendil-works/pi-ai";
import {
  appendTextBlock,
  appendThinkingBlock,
  getTextBlock,
  getThinkingBlock,
} from "./message-mapper.js";
import type { ParserSegment } from "./incremental-parser.js";

/**
 * 増分パーサの出力を Pi の text_* / thinking_* イベントへ変換する。
 */
export class StreamContentEmitter {
  private textIndex: number | null = null;
  private thinkingIndex: number | null = null;
  private thinkingOpen = false;
  private textEnded = false;
  private thinkingEnded = false;

  emittedThinking = false;

  constructor(
    private readonly output: AssistantMessage,
    private readonly piStream: AssistantMessageEventStream,
  ) {}

  handle(segment: ParserSegment): void {
    switch (segment.kind) {
      case "text":
        if (!segment.delta) {
          return;
        }
        this.emitTextDelta(segment.delta);
        return;
      case "thinking":
        if (!segment.delta) {
          return;
        }
        this.emitThinkingDelta(segment.delta);
        return;
      case "thinking_end":
        this.closeThinking();
        return;
      default:
        return;
    }
  }

  /**
   * `result` で最終整合し、開いているブロックを閉じる。
   * パーサ漏れ時は thinking を一括補完する。
   */
  finalizeFromResult(content: string, thinkingContent?: string): void {
    if (thinkingContent) {
      if (!this.emittedThinking) {
        this.openThinking();
        this.appendThinking(thinkingContent);
        this.emittedThinking = true;
      } else {
        const block =
          this.thinkingIndex != null ? getThinkingBlock(this.output, this.thinkingIndex) : undefined;
        if (block) {
          block.thinking = thinkingContent;
        }
      }
    }

    if (this.thinkingOpen) {
      this.closeThinking();
    }

    if (this.textIndex == null) {
      this.textIndex = appendTextBlock(this.output, "");
      this.piStream.push({
        type: "text_start",
        contentIndex: this.textIndex,
        partial: this.output,
      });
    }

    const block = getTextBlock(this.output, this.textIndex);
    if (block) {
      block.text = content;
    }

    if (!this.textEnded) {
      this.piStream.push({
        type: "text_end",
        contentIndex: this.textIndex,
        content,
        partial: this.output,
      });
      this.textEnded = true;
    }
  }

  private emitTextDelta(delta: string): void {
    this.ensureTextOpen();
    const block = getTextBlock(this.output, this.textIndex!);
    if (block) {
      block.text += delta;
    }
    this.piStream.push({
      type: "text_delta",
      contentIndex: this.textIndex!,
      delta,
      partial: this.output,
    });
  }

  private emitThinkingDelta(delta: string): void {
    this.openThinking();
    this.appendThinking(delta);
    this.emittedThinking = true;
    this.piStream.push({
      type: "thinking_delta",
      contentIndex: this.thinkingIndex!,
      delta,
      partial: this.output,
    });
  }

  private ensureTextOpen(): void {
    if (this.textIndex != null) {
      return;
    }
    this.textIndex = appendTextBlock(this.output, "");
    this.piStream.push({
      type: "text_start",
      contentIndex: this.textIndex,
      partial: this.output,
    });
  }

  private openThinking(): void {
    if (this.thinkingOpen) {
      return;
    }
    this.thinkingIndex = appendThinkingBlock(this.output, "");
    this.thinkingOpen = true;
    this.piStream.push({
      type: "thinking_start",
      contentIndex: this.thinkingIndex,
      partial: this.output,
    });
  }

  private appendThinking(delta: string): void {
    const block =
      this.thinkingIndex != null ? getThinkingBlock(this.output, this.thinkingIndex) : undefined;
    if (block) {
      block.thinking += delta;
    }
  }

  private closeThinking(): void {
    if (!this.thinkingOpen || this.thinkingEnded || this.thinkingIndex == null) {
      return;
    }

    const block = getThinkingBlock(this.output, this.thinkingIndex);
    const content = block?.thinking ?? "";
    this.piStream.push({
      type: "thinking_end",
      contentIndex: this.thinkingIndex,
      content,
      partial: this.output,
    });
    this.thinkingOpen = false;
    this.thinkingEnded = true;
  }
}
