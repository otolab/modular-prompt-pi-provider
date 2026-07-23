import type { Api, Context, Model, SimpleStreamOptions } from "@earendil-works/pi-ai";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { bridgeDriverStreamToPi } from "./adapter/stream-bridge.js";

export function streamModularPrompt(
  model: Model<Api>,
  context: Context,
  options?: SimpleStreamOptions,
) {
  const stream = createAssistantMessageEventStream();
  void bridgeDriverStreamToPi(model, context, options, stream);
  return stream;
}
