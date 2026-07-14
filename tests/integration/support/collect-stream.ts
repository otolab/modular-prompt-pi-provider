import type { AssistantMessageEventStream } from "@earendil-works/pi-ai";

/** Pi ストリームを最後まで消費し、完了した AssistantMessage を返す */
export async function collectAssistantMessage(
  stream: AssistantMessageEventStream,
) {
  for await (const _event of stream) {
    // consume events until end
  }
  return stream.result();
}
