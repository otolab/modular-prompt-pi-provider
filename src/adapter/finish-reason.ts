import type { StopReason } from "@earendil-works/pi-ai";
import type { FinishReason, QueryResult } from "@modular-prompt/driver";

export function mapStopReason(
  finishReason: FinishReason | undefined,
): Extract<StopReason, "stop" | "length" | "toolUse"> {
  switch (finishReason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "tool_calls":
      return "toolUse";
    default:
      return "stop";
  }
}

export function resolveStreamTermination(
  result: QueryResult,
  signal: AbortSignal | undefined,
): {
  event: "done" | "error";
  stopReason: StopReason;
  doneReason?: Extract<StopReason, "stop" | "length" | "toolUse">;
} {
  if (signal?.aborted) {
    return { event: "error", stopReason: "aborted" };
  }
  if (result.finishReason === "error") {
    return { event: "error", stopReason: "error" };
  }
  const doneReason = mapStopReason(result.finishReason);
  return { event: "done", stopReason: doneReason, doneReason };
}
