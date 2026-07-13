import type {
  AssistantMessage,
  AssistantMessageEventStream,
  ToolCall as PiToolCall,
} from "@earendil-works/pi-ai";
import type { ToolCall as DriverToolCall } from "@modular-prompt/driver";

function toPiToolCall(call: DriverToolCall): PiToolCall {
  return {
    type: "toolCall",
    id: call.id,
    name: call.name,
    arguments: call.arguments ?? {},
  };
}

/**
 * v1: `result.toolCalls` 確定後に `toolcall_*` を一括発行（streaming.md）。
 * MLX はストリーム中にデリミタを含む生テキストを返すため、テキストは `result.content` で上書き済みであること。
 */
export function emitToolCallsFromResult(
  toolCalls: DriverToolCall[],
  output: AssistantMessage,
  piStream: AssistantMessageEventStream,
): void {
  for (const call of toolCalls) {
    const piCall = toPiToolCall(call);
    const contentIndex = output.content.length;
    output.content.push({
      type: "toolCall",
      id: piCall.id,
      name: piCall.name,
      arguments: {},
    });

    piStream.push({
      type: "toolcall_start",
      contentIndex,
      partial: output,
    });

    const argsJson = JSON.stringify(piCall.arguments);
    piStream.push({
      type: "toolcall_delta",
      contentIndex,
      delta: argsJson,
      partial: output,
    });

    const block = output.content[contentIndex];
    if (block?.type === "toolCall") {
      block.arguments = piCall.arguments;
    }

    piStream.push({
      type: "toolcall_end",
      contentIndex,
      toolCall: piCall,
      partial: output,
    });
  }
}
