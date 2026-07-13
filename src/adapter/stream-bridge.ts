import type {
  Api,
  AssistantMessageEventStream,
  Context,
  Model,
  SimpleStreamOptions,
} from "@earendil-works/pi-ai";
import { isAborted } from "@modular-prompt/driver";
import { getDriverForModel } from "../driver/pool.js";
import { piContextToCompiledPrompt } from "./context-to-prompt.js";
import { resolveStreamTermination } from "./finish-reason.js";
import {
  appendTextBlock,
  createInitialAssistantMessage,
  getTextBlock,
} from "./message-mapper.js";
import { piOptionsToQueryOptions } from "./options.js";
import { mapQueryResultUsageToPi } from "./usage.js";

export async function bridgeDriverStreamToPi(
  model: Model<Api>,
  context: Context,
  options: SimpleStreamOptions | undefined,
  piStream: AssistantMessageEventStream,
): Promise<void> {
  const output = createInitialAssistantMessage(model);
  piStream.push({ type: "start", partial: output });

  try {
    if (isAborted(options?.signal)) {
      output.stopReason = "aborted";
      piStream.push({ type: "error", reason: "aborted", error: output });
      piStream.end();
      return;
    }

    const driver = await getDriverForModel(model.id);
    const prompt = piContextToCompiledPrompt(context);
    const queryOpts = piOptionsToQueryOptions(options, model);

    const { stream, result } = await driver.streamQuery(prompt, queryOpts);

    const textIndex = appendTextBlock(output, "");
    piStream.push({ type: "text_start", contentIndex: textIndex, partial: output });

    for await (const chunk of stream) {
      if (isAborted(options?.signal)) {
        break;
      }
      const block = getTextBlock(output, textIndex);
      if (block) {
        block.text += chunk;
        piStream.push({
          type: "text_delta",
          contentIndex: textIndex,
          delta: chunk,
          partial: output,
        });
      }
    }

    const final = await result;
    output.usage = mapQueryResultUsageToPi(final, model);

    const textBlock = getTextBlock(output, textIndex);
    if (textBlock) {
      piStream.push({
        type: "text_end",
        contentIndex: textIndex,
        content: textBlock.text,
        partial: output,
      });
    }

    const termination = resolveStreamTermination(final, options?.signal);
    output.stopReason = termination.stopReason;

    if (termination.event === "error") {
      const reason = termination.stopReason === "aborted" ? "aborted" : "error";
      piStream.push({
        type: "error",
        reason,
        error: output,
      });
    } else {
      piStream.push({
        type: "done",
        reason: termination.doneReason!,
        message: output,
      });
    }
    piStream.end();
  } catch (error) {
    output.stopReason = isAborted(options?.signal) ? "aborted" : "error";
    output.errorMessage = error instanceof Error ? error.message : String(error);
    piStream.push({ type: "error", reason: output.stopReason, error: output });
    piStream.end();
  }
}
