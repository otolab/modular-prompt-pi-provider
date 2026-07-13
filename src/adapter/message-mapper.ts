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

function piImageToAttachment(image: ImageContent): Attachment {
  return {
    type: "image_url",
    image_url: {
      url: `data:${image.mimeType};base64,${image.data}`,
    },
  };
}

function piUserContentToMp(content: UserMessage["content"]): string | Attachment[] {
  if (typeof content === "string") {
    return content;
  }
  return content.map((part) => {
    if (part.type === "image") {
      return piImageToAttachment(part);
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

export function piMessageToElements(message: Message): MessageElement[] {
  switch (message.role) {
    case "user":
      return [
        {
          type: "message",
          role: "user",
          content: piUserContentToMp(message.content),
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

export function piMessagesToElements(messages: Message[]): MessageElement[] {
  return messages.flatMap(piMessageToElements);
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

export function getTextBlock(output: AssistantMessage, index: number): TextContent | undefined {
  const block = output.content[index];
  return block?.type === "text" ? block : undefined;
}
