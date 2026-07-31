import type {
  AssistantMessage,
  ImageContent,
  Message,
  TextContent,
  ThinkingContent,
  ToolResultMessage,
  UserMessage,
} from "@earendil-works/pi-ai";
import type {
  Attachment,
  MessageElement,
  ToolCall,
  ToolResultKind,
} from "@modular-prompt/core";
import {
  collectFilePathsFromText,
  type ImageMaterializeScope,
  materializePiImageForMlx,
} from "./image-materializer.js";

function piImageToAttachment(
  image: ImageContent,
  preferredPath: string | undefined,
  scope: ImageMaterializeScope | undefined,
): Attachment {
  const url = scope
    ? scope.materialize(image, preferredPath)
    : materializePiImageForMlx(image, preferredPath);
  return {
    type: "image_url",
    image_url: { url },
  };
}

function piUserContentToMp(
  content: UserMessage["content"],
  scope?: ImageMaterializeScope,
): string | Attachment[] {
  if (typeof content === "string") {
    return content;
  }

  const filePaths = content
    .filter((part): part is TextContent => part.type === "text")
    .flatMap((part) => collectFilePathsFromText(part.text));

  let imageIndex = 0;

  return content.map((part) => {
    if (part.type === "image") {
      const preferredPath = filePaths[imageIndex];
      imageIndex += 1;
      return piImageToAttachment(part, preferredPath, scope);
    }
    return { type: "text" as const, text: part.text };
  });
}

function toolResultKind(isError: boolean | undefined): ToolResultKind {
  return isError ? "error" : "text";
}

function toolResultValue(content: ToolResultMessage["content"]): unknown {
  if (content.length === 1 && content[0]?.type === "text") {
    return content[0].text;
  }
  return content
    .map((part) => (part.type === "text" ? part.text : `[image:${part.mimeType}]`))
    .join("\n");
}

export function piMessageToElements(
  message: Message,
  scope?: ImageMaterializeScope,
): MessageElement[] {
  switch (message.role) {
    case "user":
      return [
        {
          type: "message",
          role: "user",
          content: piUserContentToMp(message.content, scope),
        },
      ];
    case "assistant": {
      const textParts: string[] = [];
      const toolCalls: ToolCall[] = [];

      for (const block of message.content) {
        if (block.type === "text" && block.text) {
          textParts.push(block.text);
        } else if (block.type === "thinking" && (block as ThinkingContent).thinking) {
          // 履歴再送: thinking はテキスト化（M1）
          textParts.push((block as ThinkingContent).thinking);
        } else if (block.type === "toolCall") {
          toolCalls.push({
            id: block.id,
            name: block.name,
            arguments: block.arguments,
          });
        }
      }

      return [
        {
          type: "message",
          role: "assistant",
          content: textParts.join(""),
          ...(toolCalls.length > 0 ? { toolCalls } : {}),
        },
      ];
    }
    case "toolResult":
      return [
        {
          type: "message",
          role: "tool",
          toolCallId: message.toolCallId,
          name: message.toolName,
          kind: toolResultKind(message.isError),
          value: toolResultValue(message.content),
        },
      ];
    default:
      return [];
  }
}

export function piMessagesToElements(
  messages: Message[],
  scope?: ImageMaterializeScope,
): MessageElement[] {
  return messages.flatMap((message) => piMessageToElements(message, scope));
}

/** Context に Pi 画像ブロックが含まれるか */
export function contextHasImages(messages: Message[]): boolean {
  for (const message of messages) {
    if (message.role !== "user") {
      continue;
    }
    const { content } = message;
    if (typeof content === "string") {
      continue;
    }
    if (content.some((part) => part.type === "image")) {
      return true;
    }
  }
  return false;
}

export function createInitialAssistantMessage(
  model: { api: string; provider: string; id: string },
): AssistantMessage {
  return {
    role: "assistant",
    content: [],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp: Date.now(),
  };
}

export function appendTextBlock(output: AssistantMessage, text: string): number {
  const block: TextContent = { type: "text", text };
  output.content.push(block);
  return output.content.length - 1;
}

export function appendThinkingBlock(output: AssistantMessage, thinking: string): number {
  const block: ThinkingContent = { type: "thinking", thinking };
  output.content.push(block);
  return output.content.length - 1;
}

export function getTextBlock(output: AssistantMessage, index: number): TextContent | undefined {
  const block = output.content[index];
  return block?.type === "text" ? block : undefined;
}

export function getThinkingBlock(
  output: AssistantMessage,
  index: number,
): ThinkingContent | undefined {
  const block = output.content[index];
  return block?.type === "thinking" ? block : undefined;
}
